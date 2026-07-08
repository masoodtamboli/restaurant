import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

const NEXT_STATUS: Record<string, string> = {
  received: "preparing",
  preparing: "ready",
  ready: "completed",
};
const STATUS_LABEL: Record<string, string> = {
  received: "RECEIVED",
  preparing: "PREPARING",
  ready: "READY",
  completed: "SERVED",
};

export default function AdminQueue() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const q = await request<any[]>("/admin/orders/live", { token: tok });
      setQueue(q);
    } catch (e: any) {
      if (e.message?.includes("token")) router.replace("/admin/login");
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

  const closeSession = async (sid: string) => {
    const tok = await store.getAdminToken();
    await request(`/admin/sessions/${sid}/close`, { method: "POST", token: tok });
    load();
  };

  // Sort: bill_requested first
  const sorted = [...queue].sort((a, b) => (a.session.status === "bill_requested" ? -1 : 1) - (b.session.status === "bill_requested" ? -1 : 1));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-queue-screen">
      <AdminNav title="Live Order Queue" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
        >
          {sorted.length === 0 && (
            <Text style={styles.empty}>No active table sessions right now.</Text>
          )}
          {sorted.map(({ session, orders }) => (
            <View key={session.id} style={[styles.sessCard, session.status === "bill_requested" && { borderColor: colors.error, borderWidth: 2 }]} testID={`session-${session.id}`}>
              <View style={styles.sessHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={styles.tableBox}>
                    <Text style={styles.tableNum}>{session.table_number}</Text>
                  </View>
                  <View>
                    <Text style={styles.sessLbl}>TABLE · {orders.length} round{orders.length !== 1 ? "s" : ""}</Text>
                    <Text style={styles.sessTotal}>{rupee(session.total_bill)}</Text>
                  </View>
                </View>
                {session.status === "bill_requested" ? (
                  <Pressable onPress={() => closeSession(session.id)} style={styles.closeBtn} testID={`close-${session.id}`}>
                    <Feather name="check" size={14} color={colors.onBrand} />
                    <Text style={styles.closeTxt}>CLOSE TABLE</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.openTag}>OPEN</Text>
                )}
              </View>

              {session.status === "bill_requested" && (
                <View style={styles.billBanner}>
                  <Feather name="alert-circle" size={14} color={colors.onBrand} />
                  <Text style={styles.billBannerTxt}>Bill Requested — go collect payment.</Text>
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
                    <Pressable
                      onPress={() => advance(o.id, o.status)}
                      style={styles.advBtn}
                      testID={`advance-${o.id}`}
                    >
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
  sessCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sessHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tableBox: { width: 48, height: 48, backgroundColor: colors.brand, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tableNum: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.saffron },
  sessLbl: { fontFamily: font.body, fontSize: 10, letterSpacing: 2, color: colors.muted, fontWeight: "800" },
  sessTotal: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.onSurface },
  openTag: { fontFamily: font.body, fontSize: 11, color: colors.success, fontWeight: "800", letterSpacing: 1 },
  billBanner: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.error, padding: spacing.sm, borderRadius: radius.sm },
  billBannerTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 12, fontWeight: "700" },
  closeBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm },
  closeTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
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
});
