import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminCustomers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const c = await request<any[]>("/admin/customers", { token: tok });
      setCustomers(c);
    } catch (e: any) {
      if (e.status === 402) router.replace("/admin/renew");
      if (e.status === 401) router.replace("/admin/login");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-customers-screen">
      <AdminNav title="Customers" />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {customers.length === 0 && <Text style={styles.empty}>No customers yet.</Text>}
          {customers.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={styles.avatar}><Feather name="user" size={18} color={colors.onBrand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nm}>{c.name}</Text>
                <Text style={styles.ph}>+91 {c.phone}</Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.oc}>{c.order_count}</Text>
                <Text style={styles.ocLbl}>ORDERS</Text>
              </View>
              <View style={[styles.rightCol, { marginLeft: spacing.md }]}>
                <Text style={styles.pts}>{c.loyalty_points}</Text>
                <Text style={styles.ocLbl}>PTS</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  empty: { fontFamily: font.body, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  nm: { fontFamily: font.display, fontWeight: "800", fontSize: 15, color: colors.onSurface },
  ph: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  rightCol: { alignItems: "center" },
  oc: { fontFamily: font.display, fontWeight: "800", fontSize: 20, color: colors.brand },
  pts: { fontFamily: font.display, fontWeight: "800", fontSize: 20, color: colors.saffron },
  ocLbl: { fontFamily: font.body, fontSize: 9, letterSpacing: 1, color: colors.muted, fontWeight: "700" },
});
