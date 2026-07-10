import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import SuperAdminNav from "@/src/SuperAdminNav";

export default function SARestaurants() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newR, setNewR] = useState<any | null>(null);
  const [newAdm, setNewAdm] = useState<any | null>(null);
  const [resetAdm, setResetAdm] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const tok = await store.getSuperAdminToken();
    if (!tok) { router.replace("/super-admin/login"); return; }
    try {
      const [rs, as] = await Promise.all([
        request<any[]>("/super-admin/restaurants", { token: tok }),
        request<any[]>("/super-admin/admins", { token: tok }),
      ]);
      setRestaurants(rs); setAdmins(as);
    } catch (e: any) {
      if (e.status === 401) router.replace("/super-admin/login");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleR = async (r: any) => {
    const tok = await store.getSuperAdminToken();
    await request(`/super-admin/restaurants/${r.id}`, { method: "PATCH", token: tok, body: { is_active: !r.is_active } });
    load();
  };

  const saveR = async () => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      await request("/super-admin/restaurants", { method: "POST", token: tok, body: newR });
      setNewR(null); load();
    } finally { setBusy(false); }
  };

  const saveAdm = async () => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      await request("/super-admin/admins", { method: "POST", token: tok, body: newAdm });
      setNewAdm(null); load();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };

  const doReset = async (new_pin: string) => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      await request("/super-admin/admins/reset-pin", { method: "POST", token: tok, body: { admin_id: resetAdm.id, new_pin } });
      setResetAdm(null);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="sa-restaurants-screen">
      <SuperAdminNav title="Restaurants" subtitle={`${restaurants.length} on platform`} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={styles.addRow}>
            <Pressable onPress={() => setNewR({ name: "", address: "", phone: "" })} style={styles.addBtn} testID="add-restaurant-btn">
              <Feather name="plus" size={14} color={colors.onBrand} />
              <Text style={styles.addTxt}>NEW RESTAURANT</Text>
            </Pressable>
          </View>

          {restaurants.map((r) => {
            const rAdmins = admins.filter((a) => a.restaurant_id === r.id);
            return (
              <View key={r.id} style={styles.card} testID={`restaurant-${r.id}`}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rName}>{r.name}</Text>
                    <Text style={styles.rAddr}>{r.address || "—"}</Text>
                  </View>
                  <View style={[styles.subPill, r.subscription_status === "active" ? { backgroundColor: colors.success } : { backgroundColor: colors.error }]}>
                    <Text style={styles.subPillTxt}>{r.subscription_status === "active" ? "SUBBED" : "INACTIVE"}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <Stat lbl="ORDERS" val={String(r.orders_count)} />
                  <Stat lbl="REVENUE" val={rupee(r.revenue)} />
                  <Stat lbl="ACTIVE" val={String(r.active_tables)} />
                </View>
                <View style={styles.adminsBox}>
                  <Text style={styles.adminsLbl}>ADMIN ACCOUNTS</Text>
                  {rAdmins.map((a) => (
                    <View key={a.id} style={styles.adminRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminNm}>{a.name}</Text>
                        <Text style={styles.adminMeta}>+91 {a.phone} · {a.is_active ? "active" : "inactive"}</Text>
                      </View>
                      <Pressable onPress={() => setResetAdm(a)} style={styles.smallBtn} testID={`reset-${a.id}`}>
                        <Feather name="key" size={12} color={colors.brand} />
                        <Text style={styles.smallTxt}>RESET PIN</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => setNewAdm({ restaurant_id: r.id, name: "", phone: "", pin: "" })}
                    style={styles.addAdmBtn}
                    testID={`add-admin-${r.id}`}
                  >
                    <Feather name="user-plus" size={14} color={colors.brand} />
                    <Text style={styles.addAdmTxt}>ADD ADMIN</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => toggleR(r)} style={[styles.toggleBtn, !r.is_active && { backgroundColor: colors.error }]} testID={`toggle-${r.id}`}>
                  <Text style={styles.toggleTxt}>{r.is_active ? "DEACTIVATE" : "REACTIVATE"}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* New restaurant modal */}
      <Modal visible={!!newR} transparent animationType="slide" onRequestClose={() => setNewR(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>New Restaurant</Text>
              <Pressable onPress={() => setNewR(null)}><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <TextInput placeholder="Name" value={newR?.name ?? ""} onChangeText={(v) => setNewR({ ...newR, name: v })} style={styles.mInput} testID="new-r-name" />
            <TextInput placeholder="Address" value={newR?.address ?? ""} onChangeText={(v) => setNewR({ ...newR, address: v })} style={styles.mInput} testID="new-r-addr" />
            <TextInput placeholder="Phone" value={newR?.phone ?? ""} onChangeText={(v) => setNewR({ ...newR, phone: v })} style={styles.mInput} keyboardType="phone-pad" testID="new-r-phone" />
            <Pressable onPress={saveR} disabled={busy || !newR?.name} style={styles.saveBtn} testID="save-r-btn">
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveTxt}>CREATE</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New admin modal */}
      <Modal visible={!!newAdm} transparent animationType="slide" onRequestClose={() => setNewAdm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>New Admin</Text>
              <Pressable onPress={() => setNewAdm(null)}><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <TextInput placeholder="Full name" value={newAdm?.name ?? ""} onChangeText={(v) => setNewAdm({ ...newAdm, name: v })} style={styles.mInput} testID="new-a-name" />
            <TextInput placeholder="Phone (10 digits)" value={newAdm?.phone ?? ""} onChangeText={(v) => setNewAdm({ ...newAdm, phone: v.replace(/[^0-9]/g, "").slice(0, 10) })} style={styles.mInput} keyboardType="phone-pad" testID="new-a-phone" />
            <TextInput placeholder="PIN (4–6 digits)" value={newAdm?.pin ?? ""} onChangeText={(v) => setNewAdm({ ...newAdm, pin: v.replace(/[^0-9]/g, "").slice(0, 6) })} style={styles.mInput} keyboardType="number-pad" testID="new-a-pin" />
            <Pressable onPress={saveAdm} disabled={busy || !newAdm?.name || !newAdm?.phone || !newAdm?.pin} style={styles.saveBtn} testID="save-a-btn">
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveTxt}>CREATE ADMIN</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reset PIN modal */}
      <Modal visible={!!resetAdm} transparent animationType="fade" onRequestClose={() => setResetAdm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Reset PIN for {resetAdm?.name}</Text>
              <Pressable onPress={() => setResetAdm(null)}><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ResetPinInput onSubmit={doReset} busy={busy} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ResetPinInput({ onSubmit, busy }: { onSubmit: (v: string) => void; busy: boolean }) {
  const [pin, setPin] = useState("");
  return (
    <View>
      <TextInput
        placeholder="New PIN (4–6 digits)"
        value={pin}
        onChangeText={(v) => setPin(v.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        style={styles.mInput}
        testID="reset-pin-input"
      />
      <Pressable disabled={busy || pin.length < 4} onPress={() => onSubmit(pin)} style={styles.saveBtn} testID="reset-pin-btn">
        {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveTxt}>RESET</Text>}
      </Pressable>
    </View>
  );
}

function Stat({ lbl, val }: { lbl: string; val: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLbl}>{lbl}</Text>
      <Text style={styles.statVal}>{val}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  addRow: { alignItems: "flex-end", marginBottom: spacing.md },
  addBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 1, fontSize: 12 },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...shadow.card },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rName: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.brand },
  rAddr: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  subPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  subPillTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  statLbl: { fontFamily: font.body, fontSize: 9, letterSpacing: 1, color: colors.muted, fontWeight: "700" },
  statVal: { fontFamily: font.display, fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  adminsBox: { marginTop: spacing.md, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  adminsLbl: { fontFamily: font.body, fontSize: 10, letterSpacing: 2, color: colors.brand, fontWeight: "800", marginBottom: 4 },
  adminRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  adminNm: { fontFamily: font.display, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  adminMeta: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm },
  smallTxt: { color: colors.brand, fontFamily: font.body, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  addAdmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed", marginTop: 6 },
  addAdmTxt: { color: colors.brand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  toggleBtn: { marginTop: spacing.md, backgroundColor: colors.brandDark, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  toggleTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.brand },
  mInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, fontFamily: font.body, fontSize: 14, marginBottom: 10, color: colors.onSurface },
  saveBtn: { backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.sm, alignItems: "center", marginTop: 4 },
  saveTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
});
