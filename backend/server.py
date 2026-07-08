"""Latur Tahari House - QR dine-in ordering backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import uuid
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Latur Tahari House API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("latur")

MOCK_OTP = "123456"
ADMIN_EMAIL = "admin@latur.com"
ADMIN_PASSWORD = "admin123"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Pydantic Models ----------
class SendOTPIn(BaseModel):
    phone: str
    name: Optional[str] = None


class VerifyOTPIn(BaseModel):
    phone: str
    otp: str
    table_id: str
    name: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    category: str
    description: str = ""
    price: float
    is_veg: bool = False
    is_popular: bool = False
    is_available: bool = True
    image_url: str = ""
    spice_level_options: List[str] = Field(default_factory=lambda: ["Mild", "Medium", "Spicy"])


class CartItem(BaseModel):
    product_id: str
    qty: int
    spice_level: Optional[str] = None
    note: Optional[str] = None


class PlaceOrderIn(BaseModel):
    table_id: str
    items: List[CartItem]


class UpdateOrderStatusIn(BaseModel):
    status: str  # received/preparing/ready/completed


class TableIn(BaseModel):
    table_number: int


class AdminLoginIn(BaseModel):
    email: str
    password: str


# ---------- Auth helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User missing")
    return user


async def get_current_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing admin token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.admin_sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid admin token")
    return {"email": sess["email"]}


# ---------- Auth ----------
@api.post("/auth/send-otp")
async def send_otp(inp: SendOTPIn):
    # Mock: always succeeds. Real MSG91 wired later.
    log.info("Mock OTP sent to %s: %s", inp.phone, MOCK_OTP)
    return {"ok": True, "message": "OTP sent", "hint": "Use 123456 (dev)"}


@api.post("/auth/verify-otp")
async def verify_otp(inp: VerifyOTPIn):
    if inp.otp != MOCK_OTP:
        raise HTTPException(400, "Invalid OTP")
    table = await db.tables.find_one({"id": inp.table_id, "is_active": True}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found or inactive")

    user = await db.users.find_one({"phone": inp.phone}, {"_id": 0})
    if not user:
        user = {
            "id": new_id(),
            "phone": inp.phone,
            "name": inp.name or f"Guest {inp.phone[-4:]}",
            "loyalty_points": 0,
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)

    # Get or create open session for this table
    session = await db.table_sessions.find_one(
        {"table_id": inp.table_id, "status": "open"}, {"_id": 0}
    )
    if not session:
        session = {
            "id": new_id(),
            "table_id": inp.table_id,
            "table_number": table["table_number"],
            "status": "open",
            "opened_at": now_iso(),
            "closed_at": None,
            "total_bill": 0.0,
            "user_ids": [user["id"]],
        }
        await db.table_sessions.insert_one(dict(session))
        session.pop("_id", None)
    else:
        if user["id"] not in session.get("user_ids", []):
            await db.table_sessions.update_one(
                {"id": session["id"]}, {"$addToSet": {"user_ids": user["id"]}}
            )

    token = new_id()
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "table_id": inp.table_id,
            "table_session_id": session["id"],
            "created_at": now_iso(),
        }
    )

    return {
        "token": token,
        "user": user,
        "table": table,
        "table_session_id": session["id"],
    }


# ---------- Menu ----------
@api.get("/menu")
async def get_menu():
    products = await db.products.find({"is_available": True}, {"_id": 0}).to_list(500)
    categories: Dict[str, list] = {}
    popular: list = []
    for p in products:
        categories.setdefault(p["category"], []).append(p)
        if p.get("is_popular"):
            popular.append(p)
    return {"popular": popular, "categories": categories, "products": products}


@api.get("/menu/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


# ---------- Tables ----------
@api.get("/tables/{table_id}")
async def get_table(table_id: str):
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Table not found")
    return t


@api.get("/tables")
async def list_tables_public():
    """For dev QR selector."""
    tables = await db.tables.find({"is_active": True}, {"_id": 0}).sort("table_number", 1).to_list(200)
    return tables


# ---------- Orders / Sessions ----------
@api.post("/orders")
async def place_order(inp: PlaceOrderIn, user=Depends(get_current_user)):
    session = await db.table_sessions.find_one(
        {"table_id": inp.table_id, "status": "open"}, {"_id": 0}
    )
    if not session:
        raise HTTPException(400, "No open session for this table")

    # Build items with price snapshot
    order_items = []
    total = 0.0
    for it in inp.items:
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod or not prod.get("is_available", True):
            raise HTTPException(400, f"Item unavailable: {it.product_id}")
        line = {
            "product_id": prod["id"],
            "name": prod["name"],
            "qty": it.qty,
            "price_at_order": prod["price"],
            "spice_level": it.spice_level,
            "note": it.note,
            "subtotal": round(prod["price"] * it.qty, 2),
        }
        total += line["subtotal"]
        order_items.append(line)

    # Round number = existing rounds + 1
    rounds_count = await db.orders.count_documents({"table_session_id": session["id"]})
    order = {
        "id": new_id(),
        "table_session_id": session["id"],
        "table_id": inp.table_id,
        "table_number": session["table_number"],
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "round_no": rounds_count + 1,
        "items": order_items,
        "subtotal": round(total, 2),
        "status": "received",
        "created_at": now_iso(),
        "ready_at": None,
        "completed_at": None,
    }
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)

    # Update session total
    await db.table_sessions.update_one(
        {"id": session["id"]}, {"$inc": {"total_bill": round(total, 2)}}
    )
    return order


@api.get("/sessions/active/{table_id}")
async def active_session(table_id: str):
    session = await db.table_sessions.find_one(
        {"table_id": table_id, "status": {"$in": ["open", "bill_requested"]}}, {"_id": 0}
    )
    if not session:
        return {"session": None, "orders": []}
    orders = await db.orders.find({"table_session_id": session["id"]}, {"_id": 0}).sort("round_no", 1).to_list(200)
    return {"session": session, "orders": orders}


@api.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.table_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Not found")
    orders = await db.orders.find({"table_session_id": session_id}, {"_id": 0}).sort("round_no", 1).to_list(200)
    return {"session": session, "orders": orders}


@api.post("/sessions/{session_id}/request-bill")
async def request_bill(session_id: str, user=Depends(get_current_user)):
    session = await db.table_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Not found")
    if session["status"] == "closed":
        raise HTTPException(400, "Session already closed")
    await db.table_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "bill_requested", "bill_requested_at": now_iso()}},
    )
    return {"ok": True}


# ---------- Admin auth ----------
@api.post("/admin/login")
async def admin_login(inp: AdminLoginIn):
    admin = await db.admins.find_one({"email": inp.email}, {"_id": 0})
    if not admin:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(inp.password.encode(), admin["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    token = new_id()
    await db.admin_sessions.insert_one(
        {"token": token, "email": inp.email, "created_at": now_iso()}
    )
    return {"token": token, "email": inp.email}


# ---------- Admin: Tables ----------
@api.get("/admin/tables")
async def admin_list_tables(admin=Depends(get_current_admin)):
    tables = await db.tables.find({}, {"_id": 0}).sort("table_number", 1).to_list(500)
    return tables


@api.post("/admin/tables")
async def admin_create_table(inp: TableIn, admin=Depends(get_current_admin)):
    existing = await db.tables.find_one({"table_number": inp.table_number}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Table number exists")
    tid = new_id()
    table = {
        "id": tid,
        "table_number": inp.table_number,
        "qr_code_url": f"latur://table/{tid}",
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.tables.insert_one(dict(table))
    table.pop("_id", None)
    return table


@api.patch("/admin/tables/{table_id}")
async def admin_toggle_table(table_id: str, body: Dict[str, Any], admin=Depends(get_current_admin)):
    upd = {}
    if "is_active" in body:
        upd["is_active"] = bool(body["is_active"])
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.tables.update_one({"id": table_id}, {"$set": upd})
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    return t


# ---------- Admin: Menu ----------
@api.get("/admin/products")
async def admin_list_products(admin=Depends(get_current_admin)):
    return await db.products.find({}, {"_id": 0}).sort("category", 1).to_list(500)


@api.post("/admin/products")
async def admin_create_product(inp: ProductIn, admin=Depends(get_current_admin)):
    p = inp.dict()
    p["id"] = new_id()
    p["created_at"] = now_iso()
    await db.products.insert_one(dict(p))
    p.pop("_id", None)
    return p


@api.patch("/admin/products/{pid}")
async def admin_update_product(pid: str, body: Dict[str, Any], admin=Depends(get_current_admin)):
    allowed = {"name", "category", "description", "price", "is_veg", "is_popular", "is_available", "image_url"}
    upd = {k: v for k, v in body.items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.products.update_one({"id": pid}, {"$set": upd})
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, admin=Depends(get_current_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ---------- Admin: Order queue ----------
@api.get("/admin/orders/live")
async def admin_live_queue(admin=Depends(get_current_admin)):
    # All open + bill_requested sessions with their orders
    sessions = await db.table_sessions.find(
        {"status": {"$in": ["open", "bill_requested"]}}, {"_id": 0}
    ).sort("opened_at", 1).to_list(200)
    result = []
    for s in sessions:
        orders = await db.orders.find({"table_session_id": s["id"]}, {"_id": 0}).sort("round_no", 1).to_list(200)
        result.append({"session": s, "orders": orders})
    return result


@api.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, inp: UpdateOrderStatusIn, admin=Depends(get_current_admin)):
    if inp.status not in {"received", "preparing", "ready", "completed"}:
        raise HTTPException(400, "Invalid status")
    upd: Dict[str, Any] = {"status": inp.status}
    if inp.status == "ready":
        upd["ready_at"] = now_iso()
    if inp.status == "completed":
        upd["completed_at"] = now_iso()
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    # If completed, credit loyalty points (1 pt / 10 rupees)
    if inp.status == "completed" and order.get("user_id"):
        pts = int(order.get("subtotal", 0) // 10)
        if pts > 0:
            await db.users.update_one({"id": order["user_id"]}, {"$inc": {"loyalty_points": pts}})
    return order


@api.post("/admin/sessions/{session_id}/close")
async def admin_close_session(session_id: str, admin=Depends(get_current_admin)):
    await db.table_sessions.update_one(
        {"id": session_id}, {"$set": {"status": "closed", "closed_at": now_iso()}}
    )
    return {"ok": True}


# ---------- Admin: Sales & customers ----------
@api.get("/admin/stats/today")
async def admin_stats_today(admin=Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": start}}, {"_id": 0}).to_list(2000)
    total_orders = len(orders)
    revenue = sum(o.get("subtotal", 0.0) for o in orders)
    # Best sellers
    counter: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            k = it["product_id"]
            counter.setdefault(k, {"product_id": k, "name": it["name"], "qty": 0})
            counter[k]["qty"] += it["qty"]
    best = sorted(counter.values(), key=lambda x: -x["qty"])[:5]

    # Avg session turn time (closed sessions today)
    closed = await db.table_sessions.find(
        {"status": "closed", "closed_at": {"$gte": start}}, {"_id": 0}
    ).to_list(500)
    turns = []
    for s in closed:
        try:
            a = datetime.fromisoformat(s["opened_at"])
            b = datetime.fromisoformat(s["closed_at"])
            turns.append((b - a).total_seconds() / 60.0)
        except Exception:
            pass
    avg_turn = round(sum(turns) / len(turns), 1) if turns else 0.0

    active_tables = await db.table_sessions.count_documents({"status": {"$in": ["open", "bill_requested"]}})
    return {
        "total_orders": total_orders,
        "revenue": round(revenue, 2),
        "best_sellers": best,
        "avg_turn_minutes": avg_turn,
        "active_tables": active_tables,
    }


@api.get("/admin/customers")
async def admin_customers(admin=Depends(get_current_admin)):
    users = await db.users.find({}, {"_id": 0}).to_list(2000)
    for u in users:
        u["order_count"] = await db.orders.count_documents({"user_id": u["id"]})
    users.sort(key=lambda u: -u["order_count"])
    return users


# ---------- Seed data ----------
async def seed():
    # Admin
    if not await db.admins.find_one({"email": ADMIN_EMAIL}):
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.admins.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "created_at": now_iso(),
        })
        log.info("Seeded admin: %s / %s", ADMIN_EMAIL, ADMIN_PASSWORD)

    # Tables
    if await db.tables.count_documents({}) == 0:
        for n in range(1, 21):
            tid = new_id()
            await db.tables.insert_one({
                "id": tid,
                "table_number": n,
                "qr_code_url": f"latur://table/{tid}",
                "is_active": True,
                "created_at": now_iso(),
            })
        log.info("Seeded 20 tables")

    # Menu
    if await db.products.count_documents({}) == 0:
        img = {
            "biryani": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80",
            "tandoori": "https://images.unsplash.com/photo-1617692855027-33b14f061079?w=800&q=80",
            "tahari": "https://images.unsplash.com/photo-1701579231349-d7459c40921c?w=800&q=80",
            "paratha": "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=80",
            "raita": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=80",
            "kebab": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
            "curry": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
            "beverage": "https://images.unsplash.com/photo-1571167530149-c72f2b6ded31?w=800&q=80",
            "roti": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80",
        }
        items = [
            # Tahari
            {"name": "Buff Tahari", "category": "Tahari", "description": "Slow-cooked buffalo tahari with fragrant basmati, whole spices and browned onions. House specialty.", "price": 260, "is_veg": False, "is_popular": True, "image_url": img["tahari"]},
            {"name": "Chicken Tahari", "category": "Tahari", "description": "Chicken cooked with rice in dum style, mildly spiced with Deccani masala.", "price": 240, "is_veg": False, "is_popular": False, "image_url": img["tahari"]},
            {"name": "Veg Tahari", "category": "Tahari", "description": "Seasonal vegetables, potatoes and basmati layered with whole garam masala.", "price": 180, "is_veg": True, "is_popular": False, "image_url": img["tahari"]},

            # Biryani
            {"name": "Chicken Biryani", "category": "Biryani", "description": "Long-grain basmati layered with saffron marinated chicken, dum sealed.", "price": 280, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Mutton Biryani", "category": "Biryani", "description": "Slow cooked mutton biryani with old Hyderabadi technique. Serves 1.", "price": 340, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Beef Banjara Biryani", "category": "Biryani", "description": "Signature Banjara style beef biryani with roasted spice crust.", "price": 300, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Veg Biryani", "category": "Biryani", "description": "Vegetable dum biryani with cashews and fried onions.", "price": 200, "is_veg": True, "is_popular": False, "image_url": img["biryani"]},

            # Tandoori
            {"name": "Tandoori Chicken (Half)", "category": "Tandoori", "description": "Clay oven roasted half chicken, yoghurt & red chilli marinade.", "price": 260, "is_veg": False, "is_popular": True, "image_url": img["tandoori"]},
            {"name": "Chicken Tikka", "category": "Tandoori", "description": "Boneless tikka chunks charred in tandoor. Served with mint chutney.", "price": 280, "is_veg": False, "is_popular": False, "image_url": img["tandoori"]},
            {"name": "Seekh Kebab", "category": "Tandoori", "description": "Minced meat kebabs on skewer with green chilli and coriander.", "price": 240, "is_veg": False, "is_popular": False, "image_url": img["kebab"]},
            {"name": "Paneer Tikka", "category": "Tandoori", "description": "Cottage cheese cubes in yoghurt marinade, tandoor grilled.", "price": 240, "is_veg": True, "is_popular": False, "image_url": img["tandoori"]},

            # Curries
            {"name": "Butter Chicken", "category": "Curries", "description": "Tandoor chicken in tomato butter gravy, fenugreek finish.", "price": 320, "is_veg": False, "is_popular": True, "image_url": img["curry"]},
            {"name": "Chicken Handi", "category": "Curries", "description": "Country-style chicken handi with onion-tomato base.", "price": 300, "is_veg": False, "is_popular": False, "image_url": img["curry"]},
            {"name": "Dal Makhani", "category": "Curries", "description": "Slow-simmered black lentils with cream and butter.", "price": 220, "is_veg": True, "is_popular": False, "image_url": img["curry"]},

            # Rotis
            {"name": "Butter Naan", "category": "Rotis", "description": "Tandoor baked naan brushed with butter.", "price": 50, "is_veg": True, "is_popular": True, "image_url": img["roti"]},
            {"name": "Paratha", "category": "Rotis", "description": "Layered whole wheat paratha, ghee finished.", "price": 45, "is_veg": True, "is_popular": True, "image_url": img["paratha"]},
            {"name": "Tandoori Roti", "category": "Rotis", "description": "Whole wheat roti straight from tandoor.", "price": 25, "is_veg": True, "is_popular": False, "image_url": img["roti"]},

            # Sides
            {"name": "Boondi Raita", "category": "Sides", "description": "Yoghurt with fried boondi and cumin.", "price": 80, "is_veg": True, "is_popular": False, "image_url": img["raita"]},
            {"name": "Onion Salad", "category": "Sides", "description": "Sliced onions with green chilli, lemon and salt.", "price": 40, "is_veg": True, "is_popular": False, "image_url": img["raita"]},
            {"name": "Papad", "category": "Sides", "description": "Roasted papad with chutneys.", "price": 30, "is_veg": True, "is_popular": False, "image_url": img["raita"]},

            # Beverages
            {"name": "Sulaimani Chai", "category": "Beverages", "description": "Deccan style black tea with lemon and spices.", "price": 40, "is_veg": True, "is_popular": True, "image_url": img["beverage"]},
            {"name": "Masala Chai", "category": "Beverages", "description": "Milk chai brewed with cardamom and ginger.", "price": 30, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
            {"name": "Rooh Afza Sherbet", "category": "Beverages", "description": "Iconic rose sherbet chilled and served over ice.", "price": 60, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
            {"name": "Fresh Lime Soda", "category": "Beverages", "description": "Fresh lemon with soda, salt/sweet options.", "price": 60, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
        ]
        for it in items:
            doc = {
                "id": new_id(),
                "spice_level_options": ["Mild", "Medium", "Spicy"],
                "is_available": True,
                "created_at": now_iso(),
                **it,
            }
            await db.products.insert_one(dict(doc))
        log.info("Seeded %d products", len(items))


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"app": "Latur Tahari House", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
