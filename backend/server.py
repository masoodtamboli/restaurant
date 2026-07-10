"""Latur Tahari House v2 — multi-tenant, WhatsApp mocked, subscription-gated admin."""
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

app = FastAPI(title="Latur Tahari House v2 API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("latur")

MOCK_OTP = "123456"
SEED_MARKER_VERSION = "v2.0"

# Bootstrap credentials (v2)
SUPER_ADMIN_PHONE = "9999999999"
SUPER_ADMIN_PASSWORD = "super123"
ADMIN_PHONE = "8888888888"
ADMIN_PIN = "1234"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_pw(s: str) -> str:
    return bcrypt.hashpw(s.encode(), bcrypt.gensalt()).decode()


def check_pw(s: str, h: str) -> bool:
    return bcrypt.checkpw(s.encode(), h.encode())


# ---------------- Models ----------------
class SendOTPIn(BaseModel):
    phone: str
    name: Optional[str] = None
    restaurant_id: str


class VerifyOTPIn(BaseModel):
    phone: str
    otp: str
    table_id: str
    restaurant_id: str
    name: Optional[str] = None


class AdminLoginIn(BaseModel):
    phone: str
    pin: str


class SuperAdminLoginIn(BaseModel):
    phone: str
    password: str


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
    status: str


class TableIn(BaseModel):
    table_number: int


class StaffCallIn(BaseModel):
    table_id: str
    reason: str  # water | cutlery | complaint | other
    note: Optional[str] = None


class RestaurantIn(BaseModel):
    name: str
    address: str = ""
    phone: str = ""
    whatsapp_business_number_id: str = ""


class CreateAdminIn(BaseModel):
    restaurant_id: str
    name: str
    phone: str
    pin: str


class ResetPinIn(BaseModel):
    admin_id: str
    new_pin: str


class PlanIn(BaseModel):
    plan_name: str
    duration_days: int
    price: float
    qr_image_url: str = ""
    is_active: bool = True


class SubscriptionRequestIn(BaseModel):
    subscription_plan_id: str
    payment_proof_base64: str  # data:image/... or raw base64
    payment_reference: str


class PromoSendIn(BaseModel):
    promo_template_id: str
    filled_variables: Dict[str, str] = Field(default_factory=dict)


# ---------------- Auth helpers ----------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.user_sessions.find_one({"token": token}, {"_id": 0})
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
    admin = await db.admins.find_one({"id": sess["admin_id"], "is_active": True}, {"_id": 0})
    if not admin:
        raise HTTPException(401, "Admin missing/inactive")
    return admin


async def get_current_super_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.super_admin_sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid token")
    sa = await db.super_admins.find_one({"id": sess["super_admin_id"]}, {"_id": 0})
    if not sa:
        raise HTTPException(401, "Super admin missing")
    return sa


async def get_active_subscription(restaurant_id: str) -> Optional[Dict[str, Any]]:
    now = now_iso()
    return await db.subscriptions.find_one(
        {"restaurant_id": restaurant_id, "status": "active", "end_date": {"$gt": now}},
        {"_id": 0},
    )


async def require_subscription(admin=Depends(get_current_admin)) -> Dict[str, Any]:
    sub = await get_active_subscription(admin["restaurant_id"])
    if not sub:
        raise HTTPException(402, "Subscription inactive — renew to continue")
    return admin


# ---------------- Public: restaurants & tables ----------------
@api.get("/restaurants/default")
async def default_restaurant():
    """Returns the default (first) active restaurant for QR simulation on landing."""
    r = await db.restaurants.find_one({"is_active": True}, {"_id": 0})
    if not r:
        raise HTTPException(404, "No restaurant")
    return r


@api.get("/tables")
async def list_tables_public(restaurant_id: Optional[str] = None):
    q: Dict[str, Any] = {"is_active": True}
    if restaurant_id:
        q["restaurant_id"] = restaurant_id
    tables = await db.tables.find(q, {"_id": 0}).sort("table_number", 1).to_list(500)
    return tables


@api.get("/tables/{table_id}")
async def get_table(table_id: str):
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Table not found")
    return t


# ---------------- Customer auth (WhatsApp OTP — MOCKED) ----------------
@api.post("/auth/send-otp")
async def send_otp(inp: SendOTPIn):
    # MOCK WhatsApp send. Real Meta Cloud API integration hook here.
    log.info("[MOCK-WHATSAPP OTP] to %s: %s", inp.phone, MOCK_OTP)
    return {"ok": True, "message": "WhatsApp OTP sent", "hint": "Dev universal OTP: 123456"}


@api.post("/auth/verify-otp")
async def verify_otp(inp: VerifyOTPIn):
    if inp.otp != MOCK_OTP:
        raise HTTPException(400, "Invalid OTP")
    table = await db.tables.find_one({"id": inp.table_id, "is_active": True}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found or inactive")
    restaurant_id = table["restaurant_id"]

    user = await db.users.find_one({"phone": inp.phone, "restaurant_id": restaurant_id}, {"_id": 0})
    if not user:
        user = {
            "id": new_id(),
            "restaurant_id": restaurant_id,
            "phone": inp.phone,
            "name": inp.name or f"Guest {inp.phone[-4:]}",
            "loyalty_points": 0,
            "whatsapp_opted_in": True,  # implicit opt-in via WhatsApp OTP
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)

    session = await db.table_sessions.find_one(
        {"table_id": inp.table_id, "status": "open"}, {"_id": 0}, sort=[("opened_at", -1)]
    )
    if not session:
        session = {
            "id": new_id(),
            "restaurant_id": restaurant_id,
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
            await db.table_sessions.update_one({"id": session["id"]}, {"$addToSet": {"user_ids": user["id"]}})

    token = new_id()
    await db.user_sessions.insert_one({
        "token": token, "user_id": user["id"], "restaurant_id": restaurant_id,
        "table_id": inp.table_id, "table_session_id": session["id"], "created_at": now_iso(),
    })
    return {"token": token, "user": user, "table": table, "table_session_id": session["id"]}


# ---------------- Menu (public per restaurant) ----------------
@api.get("/menu")
async def get_menu(restaurant_id: str):
    products = await db.products.find({"restaurant_id": restaurant_id, "is_available": True}, {"_id": 0}).to_list(500)
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


# ---------------- Orders / Sessions ----------------
@api.post("/orders")
async def place_order(inp: PlaceOrderIn, user=Depends(get_current_user)):
    session = await db.table_sessions.find_one(
        {"table_id": inp.table_id, "status": "open"}, {"_id": 0}, sort=[("opened_at", -1)]
    )
    if not session:
        raise HTTPException(400, "No open session for this table")
    order_items = []
    total = 0.0
    for it in inp.items:
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod or not prod.get("is_available", True):
            raise HTTPException(400, f"Item unavailable: {it.product_id}")
        line = {
            "product_id": prod["id"], "name": prod["name"], "qty": it.qty,
            "price_at_order": prod["price"], "spice_level": it.spice_level, "note": it.note,
            "subtotal": round(prod["price"] * it.qty, 2),
        }
        total += line["subtotal"]
        order_items.append(line)
    rounds_count = await db.orders.count_documents({"table_session_id": session["id"]})
    order = {
        "id": new_id(), "restaurant_id": session["restaurant_id"],
        "table_session_id": session["id"], "table_id": inp.table_id,
        "table_number": session["table_number"], "user_id": user["id"], "user_name": user.get("name", ""),
        "round_no": rounds_count + 1, "items": order_items, "subtotal": round(total, 2),
        "status": "received", "created_at": now_iso(), "ready_at": None, "completed_at": None,
    }
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    await db.table_sessions.update_one({"id": session["id"]}, {"$inc": {"total_bill": round(total, 2)}})
    return order


@api.get("/sessions/active/{table_id}")
async def active_session(table_id: str):
    session = await db.table_sessions.find_one(
        {"table_id": table_id, "status": {"$in": ["open", "bill_requested"]}},
        {"_id": 0}, sort=[("opened_at", -1)],
    )
    if not session:
        return {"session": None, "orders": [], "staff_calls": []}
    orders = await db.orders.find({"table_session_id": session["id"]}, {"_id": 0}).sort("round_no", 1).to_list(200)
    calls = await db.staff_calls.find({"table_id": table_id, "status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"session": session, "orders": orders, "staff_calls": calls}


@api.post("/sessions/{session_id}/request-bill")
async def request_bill(session_id: str, user=Depends(get_current_user)):
    session = await db.table_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Not found")
    if session["status"] == "closed":
        raise HTTPException(400, "Session already closed")
    await db.table_sessions.update_one(
        {"id": session_id}, {"$set": {"status": "bill_requested", "bill_requested_at": now_iso()}}
    )
    return {"ok": True}


# ---------------- Staff Calls ----------------
@api.post("/staff-calls")
async def create_staff_call(inp: StaffCallIn, user=Depends(get_current_user)):
    table = await db.tables.find_one({"id": inp.table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    call = {
        "id": new_id(), "restaurant_id": table["restaurant_id"], "table_id": inp.table_id,
        "table_number": table["table_number"], "user_id": user["id"],
        "reason": inp.reason, "note": inp.note or "",
        "status": "open", "created_at": now_iso(),
        "resolved_at": None, "resolved_by": None,
    }
    await db.staff_calls.insert_one(dict(call))
    call.pop("_id", None)
    return call


# ---------------- Admin auth (phone + PIN) ----------------
@api.post("/admin/login")
async def admin_login(inp: AdminLoginIn):
    admin = await db.admins.find_one({"phone": inp.phone, "is_active": True}, {"_id": 0})
    if not admin or not check_pw(inp.pin, admin["pin_hash"]):
        raise HTTPException(401, "Invalid phone or PIN")
    token = new_id()
    await db.admin_sessions.insert_one({
        "token": token, "admin_id": admin["id"],
        "restaurant_id": admin["restaurant_id"], "created_at": now_iso(),
    })
    sub = await get_active_subscription(admin["restaurant_id"])
    admin.pop("pin_hash", None)
    return {"token": token, "admin": admin, "subscription": sub}


@api.get("/admin/me")
async def admin_me(admin=Depends(get_current_admin)):
    sub = await get_active_subscription(admin["restaurant_id"])
    a = dict(admin)
    a.pop("pin_hash", None)
    restaurant = await db.restaurants.find_one({"id": admin["restaurant_id"]}, {"_id": 0})
    return {"admin": a, "subscription": sub, "restaurant": restaurant}


# ---------------- Admin: menu / tables / orders / sessions (subscription gated) ----------------
@api.get("/admin/orders/live")
async def admin_live_queue(admin=Depends(require_subscription)):
    sessions = await db.table_sessions.find(
        {"restaurant_id": admin["restaurant_id"], "status": {"$in": ["open", "bill_requested"]}}, {"_id": 0}
    ).sort("opened_at", 1).to_list(500)
    result = []
    for s in sessions:
        orders = await db.orders.find({"table_session_id": s["id"]}, {"_id": 0}).sort("round_no", 1).to_list(200)
        result.append({"session": s, "orders": orders})
    return result


@api.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, inp: UpdateOrderStatusIn, admin=Depends(require_subscription)):
    if inp.status not in {"received", "preparing", "ready", "completed"}:
        raise HTTPException(400, "Invalid status")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or order["restaurant_id"] != admin["restaurant_id"]:
        raise HTTPException(404, "Not found")
    upd: Dict[str, Any] = {"status": inp.status}
    if inp.status == "ready":
        upd["ready_at"] = now_iso()
    if inp.status == "completed":
        upd["completed_at"] = now_iso()
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    order.update(upd)
    if inp.status == "completed" and order.get("user_id"):
        pts = int(order.get("subtotal", 0) // 10)
        if pts > 0:
            await db.users.update_one({"id": order["user_id"]}, {"$inc": {"loyalty_points": pts}})
    return order


@api.post("/admin/sessions/{session_id}/clean-table")
async def admin_clean_table(session_id: str, admin=Depends(require_subscription)):
    """Generates itemized bill, MOCK-sends WhatsApp bill template, closes session."""
    session = await db.table_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session or session["restaurant_id"] != admin["restaurant_id"]:
        raise HTTPException(404, "Not found")
    if session["status"] == "closed":
        raise HTTPException(400, "Already closed")
    orders = await db.orders.find({"table_session_id": session_id}, {"_id": 0}).to_list(200)
    line_items = []
    for o in orders:
        for it in o.get("items", []):
            line_items.append({"name": it["name"], "qty": it["qty"], "subtotal": it["subtotal"]})
    total = round(sum(o.get("subtotal", 0) for o in orders), 2)
    # Fetch user phone for WhatsApp bill send
    user_ids = session.get("user_ids", [])
    phones = []
    if user_ids:
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0}).to_list(50)
        phones = [u["phone"] for u in users]

    # MOCK WhatsApp bill send
    mock_payload = {
        "template": "bill_delivery",
        "to": phones,
        "variables": {
            "table_number": session.get("table_number"),
            "total": total,
            "line_items": line_items,
            "sent_at": now_iso(),
        },
    }
    log.info("[MOCK-WHATSAPP BILL] %s", mock_payload)

    await db.table_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "closed", "closed_at": now_iso(), "final_total": total, "bill_line_items": line_items}},
    )
    await db.bill_sends.insert_one({
        "id": new_id(), "restaurant_id": admin["restaurant_id"], "table_session_id": session_id,
        "total": total, "phones": phones, "line_items": line_items,
        "sent_at": now_iso(), "mock": True,
    })
    return {"ok": True, "bill": {"line_items": line_items, "total": total, "phones": phones}}


@api.get("/admin/products")
async def admin_list_products(admin=Depends(require_subscription)):
    return await db.products.find({"restaurant_id": admin["restaurant_id"]}, {"_id": 0}).sort("category", 1).to_list(500)


@api.post("/admin/products")
async def admin_create_product(inp: ProductIn, admin=Depends(require_subscription)):
    p = inp.dict()
    p["id"] = new_id()
    p["restaurant_id"] = admin["restaurant_id"]
    p["created_at"] = now_iso()
    await db.products.insert_one(dict(p))
    p.pop("_id", None)
    return p


@api.patch("/admin/products/{pid}")
async def admin_update_product(pid: str, body: Dict[str, Any], admin=Depends(require_subscription)):
    allowed = {"name", "category", "description", "price", "is_veg", "is_popular", "is_available", "image_url"}
    upd = {k: v for k, v in body.items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.products.update_one({"id": pid, "restaurant_id": admin["restaurant_id"]}, {"$set": upd})
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, admin=Depends(require_subscription)):
    await db.products.delete_one({"id": pid, "restaurant_id": admin["restaurant_id"]})
    return {"ok": True}


@api.get("/admin/tables")
async def admin_list_tables(admin=Depends(require_subscription)):
    return await db.tables.find({"restaurant_id": admin["restaurant_id"]}, {"_id": 0}).sort("table_number", 1).to_list(500)


@api.post("/admin/tables")
async def admin_create_table(inp: TableIn, admin=Depends(require_subscription)):
    existing = await db.tables.find_one({"restaurant_id": admin["restaurant_id"], "table_number": inp.table_number}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Table number exists")
    tid = new_id()
    table = {
        "id": tid, "restaurant_id": admin["restaurant_id"], "table_number": inp.table_number,
        "qr_code_url": f"latur://table/{tid}", "is_active": True, "created_at": now_iso(),
    }
    await db.tables.insert_one(dict(table))
    table.pop("_id", None)
    return table


@api.patch("/admin/tables/{table_id}")
async def admin_toggle_table(table_id: str, body: Dict[str, Any], admin=Depends(require_subscription)):
    upd = {}
    if "is_active" in body:
        upd["is_active"] = bool(body["is_active"])
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.tables.update_one({"id": table_id, "restaurant_id": admin["restaurant_id"]}, {"$set": upd})
    return await db.tables.find_one({"id": table_id}, {"_id": 0})


# ---------------- Admin: Staff calls queue ----------------
@api.get("/admin/staff-calls")
async def admin_staff_calls(admin=Depends(require_subscription), only_open: bool = True):
    q: Dict[str, Any] = {"restaurant_id": admin["restaurant_id"]}
    if only_open:
        q["status"] = "open"
    return await db.staff_calls.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.patch("/admin/staff-calls/{call_id}/resolve")
async def admin_resolve_call(call_id: str, admin=Depends(require_subscription)):
    await db.staff_calls.update_one(
        {"id": call_id, "restaurant_id": admin["restaurant_id"]},
        {"$set": {"status": "resolved", "resolved_at": now_iso(), "resolved_by": admin["id"]}},
    )
    return {"ok": True}


# ---------------- Admin: Stats & customers ----------------
@api.get("/admin/stats/today")
async def admin_stats_today(admin=Depends(require_subscription)):
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    orders = await db.orders.find(
        {"restaurant_id": admin["restaurant_id"], "created_at": {"$gte": start}}, {"_id": 0}
    ).to_list(2000)
    counter: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            k = it["product_id"]
            counter.setdefault(k, {"product_id": k, "name": it["name"], "qty": 0})
            counter[k]["qty"] += it["qty"]
    best = sorted(counter.values(), key=lambda x: -x["qty"])[:5]
    closed = await db.table_sessions.find(
        {"restaurant_id": admin["restaurant_id"], "status": "closed", "closed_at": {"$gte": start}},
        {"_id": 0},
    ).to_list(500)
    turns: List[float] = []
    for s in closed:
        try:
            a = datetime.fromisoformat(s["opened_at"])
            b = datetime.fromisoformat(s["closed_at"])
            turns.append((b - a).total_seconds() / 60.0)
        except Exception:
            pass
    avg_turn = round(sum(turns) / len(turns), 1) if turns else 0.0
    active_tables = await db.table_sessions.count_documents(
        {"restaurant_id": admin["restaurant_id"], "status": {"$in": ["open", "bill_requested"]}}
    )
    return {
        "total_orders": len(orders),
        "revenue": round(sum(o.get("subtotal", 0.0) for o in orders), 2),
        "best_sellers": best,
        "avg_turn_minutes": avg_turn,
        "active_tables": active_tables,
    }


@api.get("/admin/customers")
async def admin_customers(admin=Depends(require_subscription)):
    users = await db.users.find({"restaurant_id": admin["restaurant_id"]}, {"_id": 0}).to_list(2000)
    for u in users:
        u["order_count"] = await db.orders.count_documents({"user_id": u["id"], "restaurant_id": admin["restaurant_id"]})
    users.sort(key=lambda u: -u["order_count"])
    return users


# ---------------- Admin: Promo composer ----------------
@api.get("/admin/promo-templates")
async def list_promo_templates(admin=Depends(require_subscription)):
    return await db.promo_templates.find({"restaurant_id": admin["restaurant_id"], "is_active": True}, {"_id": 0}).to_list(50)


@api.post("/admin/promos/send")
async def send_promo(inp: PromoSendIn, admin=Depends(require_subscription)):
    tpl = await db.promo_templates.find_one({"id": inp.promo_template_id, "restaurant_id": admin["restaurant_id"]}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Template not found")
    recipients = await db.users.find(
        {"restaurant_id": admin["restaurant_id"], "whatsapp_opted_in": True}, {"_id": 0, "phone": 1}
    ).to_list(2000)
    phones = [r["phone"] for r in recipients]
    # MOCK WhatsApp broadcast
    log.info("[MOCK-WHATSAPP PROMO] template=%s vars=%s recipients=%d",
             tpl.get("whatsapp_template_id"), inp.filled_variables, len(phones))
    send = {
        "id": new_id(), "restaurant_id": admin["restaurant_id"],
        "promo_template_id": inp.promo_template_id, "sent_by": admin["id"],
        "sent_at": now_iso(), "recipient_count": len(phones),
        "filled_variables": inp.filled_variables, "phones_sample": phones[:5], "mock": True,
    }
    await db.promo_sends.insert_one(dict(send))
    send.pop("_id", None)
    return send


@api.get("/admin/promos/sends")
async def list_promo_sends(admin=Depends(require_subscription)):
    return await db.promo_sends.find({"restaurant_id": admin["restaurant_id"]}, {"_id": 0}).sort("sent_at", -1).to_list(100)


# ---------------- Admin: subscription (NOT gated) ----------------
@api.get("/admin/subscriptions/status")
async def sub_status(admin=Depends(get_current_admin)):
    active = await get_active_subscription(admin["restaurant_id"])
    history = await db.subscriptions.find(
        {"restaurant_id": admin["restaurant_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).sort("duration_days", 1).to_list(50)
    days_left = None
    if active:
        try:
            end = datetime.fromisoformat(active["end_date"])
            days_left = max(0, (end - datetime.now(timezone.utc)).days)
        except Exception:
            pass
    return {"active": active, "history": history, "plans": plans, "days_left": days_left}


@api.post("/admin/subscriptions/request")
async def sub_request(inp: SubscriptionRequestIn, admin=Depends(get_current_admin)):
    plan = await db.subscription_plans.find_one({"id": inp.subscription_plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")
    sub = {
        "id": new_id(), "restaurant_id": admin["restaurant_id"],
        "subscription_plan_id": plan["id"], "plan_name": plan["plan_name"],
        "amount_paid": plan["price"], "payment_proof_base64": inp.payment_proof_base64,
        "payment_reference": inp.payment_reference,
        "status": "pending_verification", "requested_by": admin["id"],
        "created_at": now_iso(), "start_date": None, "end_date": None,
        "activated_by": None, "activated_at": None,
        "duration_days": plan["duration_days"],
    }
    await db.subscriptions.insert_one(dict(sub))
    sub.pop("_id", None)
    sub.pop("payment_proof_base64", None)  # don't echo huge string back
    return sub


# ---------------- Super admin: auth ----------------
@api.post("/super-admin/login")
async def super_admin_login(inp: SuperAdminLoginIn):
    sa = await db.super_admins.find_one({"phone": inp.phone}, {"_id": 0})
    if not sa or not check_pw(inp.password, sa["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = new_id()
    await db.super_admin_sessions.insert_one({
        "token": token, "super_admin_id": sa["id"], "created_at": now_iso(),
    })
    sa.pop("password_hash", None)
    return {"token": token, "super_admin": sa}


@api.get("/super-admin/me")
async def super_admin_me(sa=Depends(get_current_super_admin)):
    sa2 = dict(sa)
    sa2.pop("password_hash", None)
    return sa2


# ---------------- Super admin: restaurants + admin bootstrap ----------------
@api.get("/super-admin/restaurants")
async def sa_list_restaurants(sa=Depends(get_current_super_admin)):
    rs = await db.restaurants.find({}, {"_id": 0}).to_list(500)
    for r in rs:
        r["orders_count"] = await db.orders.count_documents({"restaurant_id": r["id"]})
        r["revenue"] = round(sum(
            (o.get("subtotal", 0) or 0) for o in
            await db.orders.find({"restaurant_id": r["id"]}, {"_id": 0, "subtotal": 1}).to_list(5000)
        ), 2)
        r["active_tables"] = await db.table_sessions.count_documents(
            {"restaurant_id": r["id"], "status": {"$in": ["open", "bill_requested"]}}
        )
        sub = await get_active_subscription(r["id"])
        r["subscription_status"] = "active" if sub else "inactive"
    return rs


@api.post("/super-admin/restaurants")
async def sa_create_restaurant(inp: RestaurantIn, sa=Depends(get_current_super_admin)):
    r = {"id": new_id(), "is_active": True, "created_at": now_iso(), **inp.dict()}
    await db.restaurants.insert_one(dict(r))
    r.pop("_id", None)
    return r


@api.patch("/super-admin/restaurants/{rid}")
async def sa_toggle_restaurant(rid: str, body: Dict[str, Any], sa=Depends(get_current_super_admin)):
    upd = {k: v for k, v in body.items() if k in {"name", "address", "phone", "is_active", "whatsapp_business_number_id"}}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.restaurants.update_one({"id": rid}, {"$set": upd})
    return await db.restaurants.find_one({"id": rid}, {"_id": 0})


@api.get("/super-admin/admins")
async def sa_list_admins(sa=Depends(get_current_super_admin)):
    admins = await db.admins.find({}, {"_id": 0, "pin_hash": 0}).to_list(500)
    return admins


@api.post("/super-admin/admins")
async def sa_create_admin(inp: CreateAdminIn, sa=Depends(get_current_super_admin)):
    exists = await db.admins.find_one({"phone": inp.phone}, {"_id": 0})
    if exists:
        raise HTTPException(400, "Admin phone already exists")
    admin = {
        "id": new_id(), "restaurant_id": inp.restaurant_id,
        "name": inp.name, "phone": inp.phone,
        "pin_hash": hash_pw(inp.pin), "is_active": True,
        "created_by": sa["id"], "created_at": now_iso(),
    }
    await db.admins.insert_one(dict(admin))
    admin.pop("_id", None); admin.pop("pin_hash", None)
    return admin


@api.post("/super-admin/admins/reset-pin")
async def sa_reset_pin(inp: ResetPinIn, sa=Depends(get_current_super_admin)):
    admin = await db.admins.find_one({"id": inp.admin_id}, {"_id": 0})
    if not admin:
        raise HTTPException(404, "Admin not found")
    await db.admins.update_one({"id": inp.admin_id}, {"$set": {"pin_hash": hash_pw(inp.new_pin)}})
    return {"ok": True}


# ---------------- Super admin: subscription plans ----------------
@api.get("/super-admin/plans")
async def sa_list_plans(sa=Depends(get_current_super_admin)):
    return await db.subscription_plans.find({}, {"_id": 0}).sort("duration_days", 1).to_list(50)


@api.post("/super-admin/plans")
async def sa_create_plan(inp: PlanIn, sa=Depends(get_current_super_admin)):
    p = {"id": new_id(), "created_at": now_iso(), **inp.dict()}
    if not p.get("qr_image_url"):
        p["qr_image_url"] = _qr_for_amount(p["price"])
    await db.subscription_plans.insert_one(dict(p))
    p.pop("_id", None)
    return p


@api.patch("/super-admin/plans/{pid}")
async def sa_update_plan(pid: str, body: Dict[str, Any], sa=Depends(get_current_super_admin)):
    allowed = {"plan_name", "duration_days", "price", "qr_image_url", "is_active"}
    upd = {k: v for k, v in body.items() if k in allowed}
    if "price" in upd and not body.get("qr_image_url"):
        # regenerate default QR for the new price
        upd["qr_image_url"] = _qr_for_amount(upd["price"])
    await db.subscription_plans.update_one({"id": pid}, {"$set": upd})
    return await db.subscription_plans.find_one({"id": pid}, {"_id": 0})


# ---------------- Super admin: subscription approval ----------------
@api.get("/super-admin/subscriptions/pending")
async def sa_pending_subs(sa=Depends(get_current_super_admin)):
    subs = await db.subscriptions.find({"status": "pending_verification"}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Attach restaurant name
    for s in subs:
        r = await db.restaurants.find_one({"id": s["restaurant_id"]}, {"_id": 0, "name": 1})
        s["restaurant_name"] = r["name"] if r else "—"
    return subs


@api.get("/super-admin/subscriptions/all")
async def sa_all_subs(sa=Depends(get_current_super_admin)):
    subs = await db.subscriptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for s in subs:
        r = await db.restaurants.find_one({"id": s["restaurant_id"]}, {"_id": 0, "name": 1})
        s["restaurant_name"] = r["name"] if r else "—"
    return subs


async def activate_subscription(subscription_id: str, activated_by_id: Optional[str]) -> Dict[str, Any]:
    """Single callable used by super-admin approval today, callable by future payment webhook tomorrow."""
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["status"] == "active":
        return sub
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=int(sub["duration_days"]))
    upd = {
        "status": "active", "start_date": start.isoformat(),
        "end_date": end.isoformat(), "activated_by": activated_by_id,
        "activated_at": start.isoformat(),
    }
    await db.subscriptions.update_one({"id": subscription_id}, {"$set": upd})
    # Deactivate other active subs for the same restaurant (single active at a time)
    await db.subscriptions.update_many(
        {"restaurant_id": sub["restaurant_id"], "id": {"$ne": subscription_id}, "status": "active"},
        {"$set": {"status": "expired"}},
    )
    return {**sub, **upd}


@api.post("/super-admin/subscriptions/{sid}/approve")
async def sa_approve_sub(sid: str, sa=Depends(get_current_super_admin)):
    result = await activate_subscription(sid, sa["id"])
    result.pop("payment_proof_base64", None)
    return result


@api.post("/super-admin/subscriptions/{sid}/reject")
async def sa_reject_sub(sid: str, sa=Depends(get_current_super_admin)):
    await db.subscriptions.update_one(
        {"id": sid}, {"$set": {"status": "rejected", "activated_by": sa["id"], "activated_at": now_iso()}}
    )
    return {"ok": True}


# ---------------- Utils ----------------
def _qr_for_amount(amount: float) -> str:
    upi_str = f"upi://pay?pa=lathurtahari@upi&pn=Latur%20Tahari%20House&am={int(amount)}&cu=INR"
    return f"https://api.qrserver.com/v1/create-qr-code/?data={upi_str}&size=500x500&margin=20&color=7A1F2B&bgcolor=FDF6EC"


# ---------------- Seed ----------------
async def seed():
    # Version-gated wipe & reseed for v2 upgrade
    marker = await db.meta.find_one({"key": "seed_version"})
    if not marker or marker.get("value") != SEED_MARKER_VERSION:
        log.info("Seeding v2 — wiping legacy collections")
        for c in ["users", "sessions", "user_sessions", "admins", "admin_sessions",
                  "super_admins", "super_admin_sessions", "restaurants", "tables",
                  "products", "table_sessions", "orders", "staff_calls",
                  "subscription_plans", "subscriptions", "promo_templates",
                  "promo_sends", "bill_sends", "status_checks"]:
            await db[c].drop()

        # Super admin
        sa_id = new_id()
        await db.super_admins.insert_one({
            "id": sa_id, "name": "Platform Owner",
            "phone": SUPER_ADMIN_PHONE, "password_hash": hash_pw(SUPER_ADMIN_PASSWORD),
            "created_at": now_iso(),
        })

        # Restaurant
        r_id = new_id()
        await db.restaurants.insert_one({
            "id": r_id, "name": "Latur Tahari House",
            "address": "Kondhwa, Pune, Maharashtra",
            "phone": "+912012345678",
            "whatsapp_business_number_id": "MOCK_WABA_ID",
            "is_active": True, "created_at": now_iso(),
        })

        # Admin (restaurant owner)
        adm_id = new_id()
        await db.admins.insert_one({
            "id": adm_id, "restaurant_id": r_id,
            "name": "Restaurant Owner", "phone": ADMIN_PHONE,
            "pin_hash": hash_pw(ADMIN_PIN), "is_active": True,
            "created_by": sa_id, "created_at": now_iso(),
        })

        # Tables
        for n in range(1, 21):
            tid = new_id()
            await db.tables.insert_one({
                "id": tid, "restaurant_id": r_id, "table_number": n,
                "qr_code_url": f"latur://table/{tid}", "is_active": True, "created_at": now_iso(),
            })

        # Products (from v1 seed)
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
            {"name": "Buff Tahari", "category": "Tahari", "description": "Slow-cooked buffalo tahari with fragrant basmati, whole spices and browned onions. House specialty.", "price": 260, "is_veg": False, "is_popular": True, "image_url": img["tahari"]},
            {"name": "Chicken Tahari", "category": "Tahari", "description": "Chicken cooked with rice in dum style, mildly spiced with Deccani masala.", "price": 240, "is_veg": False, "is_popular": False, "image_url": img["tahari"]},
            {"name": "Veg Tahari", "category": "Tahari", "description": "Seasonal vegetables, potatoes and basmati layered with whole garam masala.", "price": 180, "is_veg": True, "is_popular": False, "image_url": img["tahari"]},
            {"name": "Chicken Biryani", "category": "Biryani", "description": "Long-grain basmati layered with saffron marinated chicken, dum sealed.", "price": 280, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Mutton Biryani", "category": "Biryani", "description": "Slow cooked mutton biryani with old Hyderabadi technique. Serves 1.", "price": 340, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Beef Banjara Biryani", "category": "Biryani", "description": "Signature Banjara style beef biryani with roasted spice crust.", "price": 300, "is_veg": False, "is_popular": True, "image_url": img["biryani"]},
            {"name": "Veg Biryani", "category": "Biryani", "description": "Vegetable dum biryani with cashews and fried onions.", "price": 200, "is_veg": True, "is_popular": False, "image_url": img["biryani"]},
            {"name": "Tandoori Chicken (Half)", "category": "Tandoori", "description": "Clay oven roasted half chicken, yoghurt & red chilli marinade.", "price": 260, "is_veg": False, "is_popular": True, "image_url": img["tandoori"]},
            {"name": "Chicken Tikka", "category": "Tandoori", "description": "Boneless tikka chunks charred in tandoor. Served with mint chutney.", "price": 280, "is_veg": False, "is_popular": False, "image_url": img["tandoori"]},
            {"name": "Seekh Kebab", "category": "Tandoori", "description": "Minced meat kebabs on skewer with green chilli and coriander.", "price": 240, "is_veg": False, "is_popular": False, "image_url": img["kebab"]},
            {"name": "Paneer Tikka", "category": "Tandoori", "description": "Cottage cheese cubes in yoghurt marinade, tandoor grilled.", "price": 240, "is_veg": True, "is_popular": False, "image_url": img["tandoori"]},
            {"name": "Butter Chicken", "category": "Curries", "description": "Tandoor chicken in tomato butter gravy, fenugreek finish.", "price": 320, "is_veg": False, "is_popular": True, "image_url": img["curry"]},
            {"name": "Chicken Handi", "category": "Curries", "description": "Country-style chicken handi with onion-tomato base.", "price": 300, "is_veg": False, "is_popular": False, "image_url": img["curry"]},
            {"name": "Dal Makhani", "category": "Curries", "description": "Slow-simmered black lentils with cream and butter.", "price": 220, "is_veg": True, "is_popular": False, "image_url": img["curry"]},
            {"name": "Butter Naan", "category": "Rotis", "description": "Tandoor baked naan brushed with butter.", "price": 50, "is_veg": True, "is_popular": True, "image_url": img["roti"]},
            {"name": "Paratha", "category": "Rotis", "description": "Layered whole wheat paratha, ghee finished.", "price": 45, "is_veg": True, "is_popular": True, "image_url": img["paratha"]},
            {"name": "Tandoori Roti", "category": "Rotis", "description": "Whole wheat roti straight from tandoor.", "price": 25, "is_veg": True, "is_popular": False, "image_url": img["roti"]},
            {"name": "Boondi Raita", "category": "Sides", "description": "Yoghurt with fried boondi and cumin.", "price": 80, "is_veg": True, "is_popular": False, "image_url": img["raita"]},
            {"name": "Onion Salad", "category": "Sides", "description": "Sliced onions with green chilli, lemon and salt.", "price": 40, "is_veg": True, "is_popular": False, "image_url": img["raita"]},
            {"name": "Papad", "category": "Sides", "description": "Roasted papad with chutneys.", "price": 30, "is_veg": True, "is_popular": False, "image_url": img["raita"]},
            {"name": "Sulaimani Chai", "category": "Beverages", "description": "Deccan style black tea with lemon and spices.", "price": 40, "is_veg": True, "is_popular": True, "image_url": img["beverage"]},
            {"name": "Masala Chai", "category": "Beverages", "description": "Milk chai brewed with cardamom and ginger.", "price": 30, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
            {"name": "Rooh Afza Sherbet", "category": "Beverages", "description": "Iconic rose sherbet chilled and served over ice.", "price": 60, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
            {"name": "Fresh Lime Soda", "category": "Beverages", "description": "Fresh lemon with soda, salt/sweet options.", "price": 60, "is_veg": True, "is_popular": False, "image_url": img["beverage"]},
        ]
        for it in items:
            await db.products.insert_one({
                "id": new_id(), "restaurant_id": r_id, "spice_level_options": ["Mild", "Medium", "Spicy"],
                "is_available": True, "created_at": now_iso(), **it,
            })

        # Subscription plans
        for name, days, price in [("1 Month", 30, 799), ("3 Month", 90, 2400), ("6 Month", 180, 6000)]:
            await db.subscription_plans.insert_one({
                "id": new_id(), "plan_name": name, "duration_days": days,
                "price": float(price), "qr_image_url": _qr_for_amount(price),
                "is_active": True, "created_at": now_iso(),
            })

        # Seed an initial ACTIVE 30-day subscription so admin can access dashboard immediately.
        first_plan = await db.subscription_plans.find_one({"duration_days": 30}, {"_id": 0})
        if first_plan:
            start = datetime.now(timezone.utc)
            end = start + timedelta(days=30)
            await db.subscriptions.insert_one({
                "id": new_id(), "restaurant_id": r_id,
                "subscription_plan_id": first_plan["id"],
                "plan_name": first_plan["plan_name"],
                "amount_paid": first_plan["price"],
                "payment_proof_base64": "", "payment_reference": "SEED",
                "status": "active", "requested_by": adm_id,
                "created_at": start.isoformat(),
                "start_date": start.isoformat(), "end_date": end.isoformat(),
                "activated_by": sa_id, "activated_at": start.isoformat(),
                "duration_days": 30,
            })

        # Promo templates (pre-approved WhatsApp templates)
        for name, wa_id, vars_ in [
            ("Happy Hour", "happy_hour_discount", ["discount_percent", "time_window"]),
            ("Weekend Special", "weekend_biryani_offer", ["dish_name", "price"]),
            ("Ramzan Iftar", "iftar_deal", ["dish_name"]),
        ]:
            await db.promo_templates.insert_one({
                "id": new_id(), "restaurant_id": r_id,
                "template_name": name, "whatsapp_template_id": wa_id,
                "variable_fields": vars_, "is_active": True, "created_at": now_iso(),
            })

        await db.meta.update_one({"key": "seed_version"}, {"$set": {"value": SEED_MARKER_VERSION}}, upsert=True)
        log.info("v2 seed complete. Super admin: %s / %s | Admin: %s / %s | Restaurant: %s",
                 SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD, ADMIN_PHONE, ADMIN_PIN, r_id)


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"app": "Latur Tahari House v2", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)
