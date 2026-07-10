import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const API = `${BASE}/api`;

type ReqOpts = {
  method?: string;
  body?: any;
  token?: string | null;
};

export async function request<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.detail)) {
        msg = parsed.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      } else if (typeof parsed.detail === "string") {
        msg = parsed.detail;
      } else if (parsed.detail) {
        msg = JSON.stringify(parsed.detail);
      }
    } catch {}
    const err: any = new Error(msg || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

const K = {
  token: "lth_token",
  user: "lth_user",
  table: "lth_table",
  restaurant: "lth_restaurant",
  cart: "lth_cart",
  adminToken: "lth_admin_token",
  admin: "lth_admin",
  superAdminToken: "lth_sa_token",
  superAdmin: "lth_sa",
};

export const store = {
  async setSession(token: string, user: any, table: any, tableSessionId: string) {
    await AsyncStorage.multiSet([
      [K.token, token],
      [K.user, JSON.stringify(user)],
      [K.table, JSON.stringify({ ...table, table_session_id: tableSessionId })],
    ]);
  },
  async setRestaurant(r: any) { await AsyncStorage.setItem(K.restaurant, JSON.stringify(r)); },
  async getRestaurant() { const v = await AsyncStorage.getItem(K.restaurant); return v ? JSON.parse(v) : null; },
  async getToken() { return AsyncStorage.getItem(K.token); },
  async getUser() { const v = await AsyncStorage.getItem(K.user); return v ? JSON.parse(v) : null; },
  async getTable() { const v = await AsyncStorage.getItem(K.table); return v ? JSON.parse(v) : null; },
  async clearSession() { await AsyncStorage.multiRemove([K.token, K.user, K.table, K.cart]); },
  async getCart(): Promise<CartLine[]> { const v = await AsyncStorage.getItem(K.cart); return v ? JSON.parse(v) : []; },
  async setCart(cart: CartLine[]) { await AsyncStorage.setItem(K.cart, JSON.stringify(cart)); },
  async clearCart() { await AsyncStorage.removeItem(K.cart); },
  async setAdmin(token: string, admin: any) {
    await AsyncStorage.multiSet([[K.adminToken, token], [K.admin, JSON.stringify(admin)]]);
  },
  async getAdminToken() { return AsyncStorage.getItem(K.adminToken); },
  async getAdmin() { const v = await AsyncStorage.getItem(K.admin); return v ? JSON.parse(v) : null; },
  async clearAdmin() { await AsyncStorage.multiRemove([K.adminToken, K.admin]); },
  async setSuperAdmin(token: string, sa: any) {
    await AsyncStorage.multiSet([[K.superAdminToken, token], [K.superAdmin, JSON.stringify(sa)]]);
  },
  async getSuperAdminToken() { return AsyncStorage.getItem(K.superAdminToken); },
  async clearSuperAdmin() { await AsyncStorage.multiRemove([K.superAdminToken, K.superAdmin]); },
};

export type CartLine = {
  product_id: string;
  name: string;
  qty: number;
  price: number;
  image_url?: string;
  is_veg?: boolean;
  spice_level?: string;
  note?: string;
};
