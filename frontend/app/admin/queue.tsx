import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

const NEXT_STATUS: Record<string, string> = { received: "preparing", preparing: "ready", ready: "completed" };
const STATUS_LABEL: Record<string, string> = { received: "RECEIVED", preparing: "PREPARING", ready: "READY", completed: "SERVED" };

export default function AdminQueue() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openCalls, setOpenCalls] = useState<number>(0);
  const [billPreview, setBillPreview] = useState<any>(null);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const [q, calls] = await Promise.all([
        request<any[]>("/admin/orders/live", { token: tok }),
        request<any[]>("/admin/staff-calls", { token: tok }),
      ]);
      setQueue(q);
      setOpenCalls(calls.length);
    } catch (e: any) {
      if (e.status === 401) router.replace("/admin/login");
      else if (e.status === 402) router.replace("/admin/renew");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const advance = async (orderId: string, current: string) => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    const tok = await store.getAdminToken();
    await request(`/admin/orders/${orderId}/status`, { method: "PATCH", token: tok, body: { status: next } });
    load();
  };

  const cleanTable = async (sid: string) => {
    const tok = await store.getAdminToken();
    const r = await request<any>(`/admin/sessions/${sid}/clean-table`, { method: "POST", token: tok });
    setBillPreview(r.bill);
    load();
  };

  const sorted = [...queue].sort((a, b) => (a.session.status === "bill_requested" ? -1 : 1) - (b.session.status === "bill_requested" ? -1 : 1));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-queue-screen">
      <AdminNav title="Live Queue" subtitle={openCalls > 0 ? `${openCalls} staff call${openCalls > 1 ? "s" : ""} open` : undefined} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
        >
          {openCalls > 0 && (
            <Pressable onPress={() => router.push("/admin/staff-calls")} style={styles.callAlert} testID="calls-alert">
              <Feather name="bell" size={16} color={colors.onSaffron} />
              <Text style={styles.callAlertTxt}>{openCalls} staff call{openCalls > 1 ? "s" : ""} waiting — tap to handle</Text>
              <Feather name="chevron-right" size={16} color={colors.onSaffron} />
            </Pressable>
          )}

          {sorted.length === 0 && <Text style={styles.empty}>No active table sessions right now.</Text>}
          {sorted.map(({ session, orders }) => (
            <View key={session.id} style={[styles.sessCard, session.status === "bill_requested" && { borderColor: colors.error, borderWidth: 2 }]} testID={`session-${session.id}`}>
              <View style={styles.sessHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={styles.tableBox}><Text style={styles.tableNum}>{session.table_number}</Text></View>
                  <View>
                    <Text style={styles.sessLbl}>TABLE · {orders.length} round{orders.length !== 1 ? "s" : ""}</Text>
                    <Text style={styles.sessTotal}>{rupee(session.total_bill)}</Text>
                  </View>
                </View>
                {session.status === "bill_requested" ? (
                  <Pressable onPress={() => cleanTable(session.id)} style={styles.cleanBtn} testID={`clean-${session.id}`}>
                    <Feather name="send" size={14} color={colors.onBrand} />
                    <Text style={styles.cleanTxt}>CLEAN TABLE</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.openTag}>OPEN</Text>
                )}
              </View>

              {session.status === "bill_requested" && (
                <View style={styles.billBanner}>
                  <Feather name="alert-circle" size={14} color={colors.onBrand} />
                  <Text style={styles.billBannerTxt}>Bill Requested — tap CLEAN TABLE to send itemized bill via WhatsApp</Text>
                </View>
              )}

              {orders.map((o: any) => (
                <View key={o.id} style={styles.roundBox}>
                  <View style={styles.roundHead}>
                    <Text style={styles.roundLbl}>ROUND {o.round_no} · #{o.id.slice(-6).toUpperCase()}</Text>
                    <View style={[styles.pill, statusBg(o.status)]}>
                      <Text style={styles.pillTxt}>{STATUS_LABEL[o.status]}</Text>
                    </View>
                  </View>
                  {o.items.map((it: any, i: number) => (
                    <View key={i} style={styles.itemLine}>
                      <Text style={styles.itemQ}>{it.qty}×</Text>
                      <Text style={styles.itemN} numberOfLines={1}>{it.name}{it.spice_level ? ` · ${it.spice_level}` : ""}</Text>
                      <Text style={styles.itemP}>{rupee(it.subtotal)}</Text>
                    </View>
                  ))}
                  {NEXT_STATUS[o.status] && (
                    <Pressable onPress={() => advance(o.id, o.status)} style={styles.advBtn} testID={`advance-${o.id}`}>
                      <Text style={styles.advTxt}>MARK {STATUS_LABEL[NEXT_STATUS[o.status]]}</Text>
                      <Feather name="arrow-right" size={14} color={colors.onBrand} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {billPreview && (
        <Pressable style={styles.overlay} onPress={() => setBillPreview(null)} testID="bill-preview-overlay">
          <View style={styles.billModal}>
            <View style={styles.billHead}>
              <View>
                <Text style={styles.billTitle}>WhatsApp Bill Sent</Text>
                <Text style={styles.billSub}>Mocked — real Meta Cloud API wires in later</Text>
              </View>
              <Feather name="x" size={22} color={colors.onSurface} />
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {billPreview.line_items.map((it: any, i: number) => (
                <View key={i} style={styles.billLine}>
                  <Text style={styles.billQty}>{it.qty}×</Text>
                  <Text style={styles.billName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.billPrice}>{rupee(it.subtotal)}</Text>
                </View>
              ))}
              <View style={styles.billTotalRow}>
                <Text style={styles.billTotalLbl}>TOTAL</Text>
                <Text style={styles.billTotalVal}>{rupee(billPreview.total)}</Text>
              </View>
              <Text style={styles.billPhones}>Sent to: {billPreview.phones.join(", ") || "—"}</Text>
            </ScrollView>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const statusBg = (s: string) => {
  if (s === "ready") return { backgroundColor: colors.success };
  if (s === "completed") return { backgroundColor: colors.muted };
  if (s === "preparing") return { backgroundColor: colors.saffron };
  return { backgroundColor: colors.brandDark };
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.xl, fontFamily: font.body },
  callAlert: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.saffron, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, ...shadow.card },
  callAlertTxt: { flex: 1, fontFamily: font.body, fontWeight: "800", fontSize: 13, color: colors.onSaffron, letterSpacing: 0.5 },
  sessCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sessHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tableBox: { width: 48, height: 48, backgroundColor: colors.brand, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tableNum: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.saffron },
  sessLbl: { fontFamily: font.body, fontSize: 10, letterSpacing: 2, color: colors.muted, fontWeight: "800" },
  sessTotal: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.onSurface },
  openTag: { fontFamily: font.body, fontSize: 11, color: colors.success, fontWeight: "800", letterSpacing: 1 },
  billBanner: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.error, padding: spacing.sm, borderRadius: radius.sm },
  billBannerTxt: { flex: 1, color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "700" },
  cleanBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.sm },
  cleanTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  roundBox: { marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  roundHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  roundLbl: { fontFamily: font.display, fontSize: 12, fontWeight: "800", color: colors.brand, letterSpacing: 0.5 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  pillTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  itemLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 3 },
  itemQ: { fontFamily: font.display, fontSize: 12, fontWeight: "800", color: colors.brand, minWidth: 24 },
  itemN: { flex: 1, fontFamily: font.body, fontSize: 13, color: colors.onSurface },
  itemP: { fontFamily: font.display, fontWeight: "800", fontSize: 12, color: colors.onSurface },
  advBtn: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, paddingVertical: 10, borderRadius: radius.sm },
  advTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 12, letterSpacing: 1.5 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  billModal: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, width: "100%", maxWidth: 380 },
  billHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  billTitle: { fontFamily: font.display, fontSize: 20, fontWeight: "800", color: colors.success },
  billSub: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  billLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  billQty: { fontFamily: font.display, fontWeight: "800", fontSize: 12, color: colors.brand, minWidth: 24 },
  billName: { flex: 1, fontFamily: font.body, fontSize: 13, color: colors.onSurface },
  billPrice: { fontFamily: font.display, fontWeight: "800", fontSize: 12, color: colors.onSurface },
  billTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.brand },
  billTotalLbl: { fontFamily: font.body, fontSize: 12, fontWeight: "800", letterSpacing: 2, color: colors.muted },
  billTotalVal: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.brand },
  billPhones: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: spacing.sm },
});
