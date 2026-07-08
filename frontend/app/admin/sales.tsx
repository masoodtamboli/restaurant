import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminSales() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    const s = await request<any>("/admin/stats/today", { token: tok });
    setStats(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-sales-screen">
      <AdminNav title="Today's Sales" />
      {!stats ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={styles.grid}>
            <Stat label="ORDERS" value={String(stats.total_orders)} />
            <Stat label="REVENUE" value={rupee(stats.revenue)} big />
            <Stat label="ACTIVE TABLES" value={String(stats.active_tables)} />
            <Stat label="AVG TURN" value={`${stats.avg_turn_minutes}m`} />
          </View>

          <Text style={styles.section}>BEST SELLERS TODAY</Text>
          <View style={styles.card}>
            {stats.best_sellers.length === 0 ? (
              <Text style={styles.empty}>No sales yet today.</Text>
            ) : stats.best_sellers.map((b: any, i: number) => (
              <View key={b.product_id} style={styles.bsRow}>
                <Text style={styles.bsRank}>{i + 1}</Text>
                <Text style={styles.bsName} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.bsQty}>×{b.qty}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={[styles.stat, big && { backgroundColor: colors.brand }]}>
      <Text style={[styles.statLbl, big && { color: colors.saffron }]}>{label}</Text>
      <Text style={[styles.statVal, big && { color: colors.onBrand, fontSize: 28 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "48%", backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statLbl: { fontFamily: font.body, fontSize: 11, letterSpacing: 2, color: colors.muted, fontWeight: "800" },
  statVal: { fontFamily: font.display, fontSize: 24, fontWeight: "800", color: colors.brand, marginTop: 6 },
  section: { fontFamily: font.body, fontSize: 11, letterSpacing: 3, color: colors.brand, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  empty: { fontFamily: font.body, color: colors.muted, textAlign: "center", padding: spacing.md },
  bsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  bsRank: { fontFamily: font.display, fontWeight: "800", fontSize: 18, color: colors.saffron, minWidth: 28 },
  bsName: { flex: 1, fontFamily: font.body, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  bsQty: { fontFamily: font.display, fontWeight: "800", fontSize: 14, color: colors.brand },
});
