"""End-to-end backend tests for Latur Tahari House QR dine-in ordering API."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://deccani-dine.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _no_object_id(obj):
    """Recursively assert no '_id' key exists."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in dict: {list(obj.keys())}"
        for v in obj.values():
            _no_object_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_object_id(v)


@pytest.fixture(scope="session")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="session")
def tables(s):
    r = s.get(f"{API}/tables", timeout=30)
    assert r.status_code == 200
    data = r.json()
    _no_object_id(data)
    assert isinstance(data, list) and len(data) >= 20
    return data


@pytest.fixture(scope="session")
def customer_auth(s, tables):
    phone = f"9{int(time.time()) % 1000000000:09d}"
    table_id = tables[0]["id"]
    r = s.post(f"{API}/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200
    r = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456", "table_id": table_id, "name": "TEST_User"})
    assert r.status_code == 200, r.text
    data = r.json()
    _no_object_id(data)
    return {"phone": phone, "table_id": table_id, "token": data["token"], "user": data["user"], "session_id": data["table_session_id"]}


@pytest.fixture(scope="session")
def admin_auth(s):
    r = s.post(f"{API}/admin/login", json={"email": "admin@latur.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------- Tables ----------------
class TestTables:
    def test_20_seeded_tables(self, tables):
        assert len(tables) >= 20
        nums = sorted(t["table_number"] for t in tables)
        assert 1 in nums and 20 in nums

    def test_no_object_id_in_tables(self, tables):
        _no_object_id(tables)


# ---------------- OTP ----------------
class TestOTP:
    def test_send_otp_ok(self, s):
        r = s.post(f"{API}/auth/send-otp", json={"phone": "9999999999"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_wrong_otp_400(self, s, tables):
        r = s.post(f"{API}/auth/verify-otp", json={"phone": "9999999999", "otp": "000000", "table_id": tables[0]["id"]})
        assert r.status_code == 400

    def test_verify_otp_shape(self, customer_auth):
        assert "token" in customer_auth and "user" in customer_auth
        assert customer_auth["session_id"]


# ---------------- Menu ----------------
class TestMenu:
    def test_menu_structure(self, s):
        r = s.get(f"{API}/menu")
        assert r.status_code == 200
        m = r.json()
        _no_object_id(m)
        assert "categories" in m and "popular" in m and "products" in m
        assert len(m["products"]) >= 20
        assert len(m["popular"]) >= 1
        # Expected categories
        for cat in ["Tahari", "Biryani", "Tandoori", "Curries", "Rotis", "Sides", "Beverages"]:
            assert cat in m["categories"], f"Missing category {cat}"


# ---------------- Orders + Multi-round Session ----------------
class TestOrders:
    def test_place_order_and_round_no(self, s, customer_auth):
        menu = s.get(f"{API}/menu").json()
        prod = menu["products"][0]
        headers = {"Authorization": f"Bearer {customer_auth['token']}"}

        r1 = s.post(f"{API}/orders", headers=headers, json={
            "table_id": customer_auth["table_id"],
            "items": [{"product_id": prod["id"], "qty": 2, "spice_level": "Medium"}],
        })
        assert r1.status_code == 200, r1.text
        o1 = r1.json()
        _no_object_id(o1)
        assert o1["round_no"] >= 1
        assert o1["table_session_id"] == customer_auth["session_id"]
        assert o1["status"] == "received"
        assert o1["subtotal"] == round(prod["price"] * 2, 2)

        # Second order - same session
        r2 = s.post(f"{API}/orders", headers=headers, json={
            "table_id": customer_auth["table_id"],
            "items": [{"product_id": prod["id"], "qty": 1}],
        })
        assert r2.status_code == 200
        o2 = r2.json()
        assert o2["table_session_id"] == customer_auth["session_id"]
        assert o2["round_no"] >= 1
        # Store for later
        pytest.first_order_id = o1["id"]
        pytest.second_order_id = o2["id"]

    def test_place_order_no_token_401(self, s, customer_auth):
        r = s.post(f"{API}/orders", json={"table_id": customer_auth["table_id"], "items": []})
        assert r.status_code == 401

    def test_active_session_with_rounds(self, s, customer_auth):
        r = s.get(f"{API}/sessions/active/{customer_auth['table_id']}")
        assert r.status_code == 200
        d = r.json()
        _no_object_id(d)
        assert d["session"] is not None
        assert d["session"]["id"] == customer_auth["session_id"]
        assert len(d["orders"]) >= 2


# ---------------- Admin auth ----------------
class TestAdminAuth:
    def test_login(self, admin_auth):
        assert admin_auth

    def test_wrong_password(self, s):
        r = s.post(f"{API}/admin/login", json={"email": "admin@latur.com", "password": "wrong"})
        assert r.status_code == 401


# ---------------- Admin order queue + status ----------------
class TestAdminOrders:
    def test_live_queue(self, s, admin_auth, customer_auth):
        r = s.get(f"{API}/admin/orders/live", headers={"Authorization": f"Bearer {admin_auth}"})
        assert r.status_code == 200
        data = r.json()
        _no_object_id(data)
        assert any(entry["session"]["id"] == customer_auth["session_id"] for entry in data)

    def test_advance_status_and_loyalty(self, s, admin_auth, customer_auth):
        oid = pytest.first_order_id
        h = {"Authorization": f"Bearer {admin_auth}"}
        for st in ["preparing", "ready", "completed"]:
            r = s.patch(f"{API}/admin/orders/{oid}/status", headers=h, json={"status": st})
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st
        # Loyalty check
        r = s.get(f"{API}/admin/customers", headers=h)
        users = r.json()
        _no_object_id(users)
        me = next((u for u in users if u["id"] == customer_auth["user"]["id"]), None)
        assert me is not None
        assert me.get("loyalty_points", 0) >= 1
        assert me.get("order_count", 0) >= 2

    def test_bad_status_400(self, s, admin_auth):
        r = s.patch(f"{API}/admin/orders/{pytest.second_order_id}/status",
                    headers={"Authorization": f"Bearer {admin_auth}"}, json={"status": "bogus"})
        assert r.status_code == 400


# ---------------- Bill request ----------------
class TestBillRequest:
    def test_request_bill(self, s, customer_auth):
        r = s.post(f"{API}/sessions/{customer_auth['session_id']}/request-bill",
                   headers={"Authorization": f"Bearer {customer_auth['token']}"})
        assert r.status_code == 200
        # Verify status flipped
        r2 = s.get(f"{API}/sessions/{customer_auth['session_id']}")
        assert r2.status_code == 200
        assert r2.json()["session"]["status"] == "bill_requested"


# ---------------- Admin stats ----------------
class TestAdminStats:
    def test_stats_today(self, s, admin_auth):
        r = s.get(f"{API}/admin/stats/today", headers={"Authorization": f"Bearer {admin_auth}"})
        assert r.status_code == 200
        d = r.json()
        _no_object_id(d)
        for k in ["total_orders", "revenue", "best_sellers", "avg_turn_minutes", "active_tables"]:
            assert k in d
        assert d["total_orders"] >= 2
        assert d["revenue"] > 0
        assert d["active_tables"] >= 1


# ---------------- Admin products ----------------
class TestAdminProducts:
    def test_admin_list_and_toggle_availability(self, s, admin_auth):
        h = {"Authorization": f"Bearer {admin_auth}"}
        r = s.get(f"{API}/admin/products", headers=h)
        assert r.status_code == 200
        prods = r.json()
        _no_object_id(prods)
        assert len(prods) >= 20
        # Pick a non-popular item, disable it
        target = next(p for p in prods if not p.get("is_popular"))
        r2 = s.patch(f"{API}/admin/products/{target['id']}", headers=h, json={"is_available": False})
        assert r2.status_code == 200
        assert r2.json()["is_available"] is False

        # Public menu must NOT contain it
        pm = s.get(f"{API}/menu").json()
        ids = {p["id"] for p in pm["products"]}
        assert target["id"] not in ids

        # Restore
        r3 = s.patch(f"{API}/admin/products/{target['id']}", headers=h, json={"is_available": True})
        assert r3.status_code == 200


# ---------------- Admin tables (CRUD) ----------------
class TestAdminTables:
    def test_admin_tables_flow(self, s, admin_auth):
        h = {"Authorization": f"Bearer {admin_auth}"}
        r = s.get(f"{API}/admin/tables", headers=h)
        assert r.status_code == 200
        existing = r.json()
        _no_object_id(existing)
        nums = [t["table_number"] for t in existing]
        new_num = max(nums) + 1
        r2 = s.post(f"{API}/admin/tables", headers=h, json={"table_number": new_num})
        assert r2.status_code == 200
        new_t = r2.json()
        assert new_t["table_number"] == new_num
        assert new_t["is_active"] is True
        # Toggle inactive
        r3 = s.patch(f"{API}/admin/tables/{new_t['id']}", headers=h, json={"is_active": False})
        assert r3.status_code == 200
        assert r3.json()["is_active"] is False
        # Restore
        s.patch(f"{API}/admin/tables/{new_t['id']}", headers=h, json={"is_active": True})
