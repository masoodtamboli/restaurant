import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: "Received", color: colors.saffron, icon: "inbox" },
  preparing: { label: "Preparing", color: colors.saffron, icon: "clock" },
  ready: { label: "Ready", color: colors.success, icon: "bell" },
  completed: { label: "Served", color: colors.muted, icon: "check-circle" },
};

export default function Tracking() {
  const router = useRouter();
  const { justPlaced } = useLocalSearchParams<{ justPlaced?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const table = await store.getTable();
    if (!table) return;
    const r = await request<any>(`/sessions/active/${table.id}`);
    setData(r);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll every 5s while on this screen
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const requestBill = async () => {
    if (!data?.session) return;
    setBusy(true);
    try {
      const tok = await store.getToken();
      await request(`/sessions/${data.session.id}/request-bill`, { method: "POST", token: tok });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.wrap}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  const session = data?.session;
  const orders: any[] = data?.orders || [];
  const billRequested = session?.status === "bill_requested";

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="tracking-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/menu")} style={styles.iconBtn} testID="tracking-back">
          <Feather name="arrow-left" size={22} color={colors.onBrand} />
        </Pressable>
        <View>
          <Text style={styles.headerTag}>YOUR ORDER</Text>
          <Text style={styles.headerTitle}>Live Tracking</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
      >
        {justPlaced && (
          <View style={styles.successCard} testID="just-placed-banner">
            <Feather name="check-circle" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Sent to Kitchen</Text>
              <Text style={styles.successSub}>Order #{String(justPlaced).slice(-6).toUpperCase()} · Est. ready in 15–25 min</Text>
            </View>
          </View>
        )}

        {orders.length === 0 && (
          <View style={styles.empty}>
            <Feather name="clipboard" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyHint}>Head back to menu and place your first round.</Text>
          </View>
        )}

        {orders.map((o) => {
          const meta = STATUS_META[o.status] || STATUS_META.received;
          return (
            <View key={o.id} style={styles.roundCard} testID={`order-${o.id}`}>
              <View style={styles.roundHead}>
                <View>
                  <Text style={styles.roundTag}>ROUND {o.round_no}</Text>
                  <Text style={styles.roundId}>#{o.id.slice(-6).toUpperCase()}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: meta.color }]}>
                  <Feather name={meta.icon} size={12} color={o.status === "completed" ? colors.onBrand : colors.onSaffron} />
                  <Text style={[styles.statusTxt, { color: o.status === "completed" ? colors.onBrand : colors.onSaffron }]}>{meta.label.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              {o.items.map((it: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.qtyPill}>{it.qty}×</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.itemPrice}>{rupee(it.subtotal)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.subRow}>
                <Text style={styles.subLbl}>Round subtotal</Text>
                <Text style={styles.subVal}>{rupee(o.subtotal)}</Text>
              </View>
            </View>
          );
        })}

        {session && (
          <View style={styles.billCard}>
            <Text style={styles.billLbl}>SESSION TOTAL SO FAR</Text>
            <Text style={styles.billVal}>{rupee(session.total_bill)}</Text>
            <Text style={styles.billNote}>Pay at the counter when you&apos;re ready to leave.</Text>
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => router.push("/menu")}
            style={[styles.addMoreBtn]}
            testID="add-more-btn"
          >
            <Feather name="plus" size={16} color={colors.brand} />
            <Text style={styles.addMoreTxt}>ADD MORE</Text>
          </Pressable>
          <Pressable
            onPress={requestBill}
            disabled={busy || billRequested || orders.length === 0}
            style={[styles.billBtn, (billRequested || orders.length === 0) && { backgroundColor: colors.muted }]}
            testID="request-bill-btn"
          >
            {busy ? <ActivityIndicator color={colors.onBrand} /> : (
              <Text style={styles.billBtnTxt}>{billRequested ? "BILL REQUESTED" : "REQUEST BILL"}</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { padding: spacing.xs },
  headerTag: { color: colors.saffron, letterSpacing: 2, fontSize: 10, fontFamily: font.body, fontWeight: "700", textAlign: "center" },
  headerTitle: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 20, textAlign: "center" },
  successCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#E5F1E4", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success, marginBottom: spacing.md },
  successTitle: { fontFamily: font.display, fontSize: 15, fontWeight: "800", color: colors.success },
  successSub: { fontFamily: font.body, fontSize: 12, color: colors.onSurface, marginTop: 2 },
  empty: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { fontFamily: font.display, fontSize: 20, fontWeight: "800", color: colors.onSurface },
  emptyHint: { fontFamily: font.body, color: colors.muted, textAlign: "center" },
  roundCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  roundHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roundTag: { fontFamily: font.body, letterSpacing: 2, fontSize: 11, color: colors.brand, fontWeight: "800" },
  roundId: { fontFamily: font.display, fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  statusTxt: { fontFamily: font.body, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  qtyPill: { fontFamily: font.display, fontWeight: "800", fontSize: 13, color: colors.brand, minWidth: 30 },
  itemName: { flex: 1, fontFamily: font.body, fontSize: 14, color: colors.onSurface, fontWeight: "600" },
  itemPrice: { fontFamily: font.display, fontWeight: "800", fontSize: 13, color: colors.onSurface },
  subRow: { flexDirection: "row", justifyContent: "space-between" },
  subLbl: { fontFamily: font.body, fontSize: 12, color: colors.muted },
  subVal: { fontFamily: font.display, fontWeight: "800", fontSize: 14, color: colors.onSurface },
  billCard: { backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md, alignItems: "center" },
  billLbl: { fontFamily: font.body, letterSpacing: 2, fontSize: 11, color: colors.saffron, fontWeight: "800" },
  billVal: { fontFamily: font.display, fontSize: 32, fontWeight: "800", color: colors.onBrand, marginTop: 4 },
  billNote: { fontFamily: font.body, fontSize: 12, color: "#c9b58f", marginTop: 6 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, ...shadow.strong },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  addMoreBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.surface },
  addMoreTxt: { color: colors.brand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
  billBtn: { flex: 1.4, paddingVertical: 14, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand },
  billBtnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
});
