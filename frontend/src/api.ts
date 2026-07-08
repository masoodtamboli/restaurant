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
      msg = JSON.parse(text).detail || text;
    } catch {}
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

// Storage keys
const K = {
  token: "lth_token",
  user: "lth_user",
  table: "lth_table",
  cart: "lth_cart",
  adminToken: "lth_admin_token",
};

export const store = {
  async setSession(token: string, user: any, table: any, tableSessionId: string) {
    await AsyncStorage.multiSet([
      [K.token, token],
      [K.user, JSON.stringify(user)],
      [K.table, JSON.stringify({ ...table, table_session_id: tableSessionId })],
    ]);
  },
  async getToken() {
    return AsyncStorage.getItem(K.token);
  },
  async getUser() {
    const v = await AsyncStorage.getItem(K.user);
    return v ? JSON.parse(v) : null;
  },
  async getTable() {
    const v = await AsyncStorage.getItem(K.table);
    return v ? JSON.parse(v) : null;
  },
  async clearSession() {
    await AsyncStorage.multiRemove([K.token, K.user, K.table, K.cart]);
  },
  async getCart(): Promise<CartLine[]> {
    const v = await AsyncStorage.getItem(K.cart);
    return v ? JSON.parse(v) : [];
  },
  async setCart(cart: CartLine[]) {
    await AsyncStorage.setItem(K.cart, JSON.stringify(cart));
  },
  async clearCart() {
    await AsyncStorage.removeItem(K.cart);
  },
  async setAdminToken(t: string) {
    await AsyncStorage.setItem(K.adminToken, t);
  },
  async getAdminToken() {
    return AsyncStorage.getItem(K.adminToken);
  },
  async clearAdminToken() {
    await AsyncStorage.removeItem(K.adminToken);
  },
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
