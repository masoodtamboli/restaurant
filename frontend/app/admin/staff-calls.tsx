import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

const REASON_META: Record<string, { label: string; icon: any; color: string }> = {
  water: { label: "Water", icon: "droplet", color: "#4A9BC7" },
  cutlery: { label: "Cutlery / Napkins", icon: "coffee", color: colors.saffron },
  complaint: { label: "Complaint", icon: "alert-triangle", color: colors.error },
  other: { label: "Other", icon: "help-circle", color: colors.muted },
};

export default function AdminStaffCalls() {
  const router = useRouter();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const r = await request<any[]>("/admin/staff-calls?only_open=true", { token: tok });
      setCalls(r);
    } catch (e: any) {
      if (e.status === 401) router.replace("/admin/login");
      else if (e.status === 402) router.replace("/admin/renew");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (id: string) => {
    const tok = await store.getAdminToken();
    await request(`/admin/staff-calls/${id}/resolve`, { method: "PATCH", token: tok });
    load();
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-calls-screen">
      <AdminNav title="Staff Calls" subtitle={`${calls.length} open`} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
        >
          {calls.length === 0 && <Text style={styles.empty}>No open calls right now.</Text>}
          {calls.map((c) => {
            const meta = REASON_META[c.reason] || REASON_META.other;
            return (
              <View key={c.id} style={styles.card} testID={`call-${c.id}`}>
                <View style={styles.head}>
                  <View style={[styles.tableBox, { backgroundColor: meta.color }]}>
                    <Text style={styles.tableNum}>{c.table_number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowLine}>
                      <Feather name={meta.icon} size={14} color={meta.color} />
                      <Text style={styles.reasonLbl}>{meta.label.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.tblLbl}>Table {c.table_number}</Text>
                    {c.note ? <Text style={styles.note}>&quot;{c.note}&quot;</Text> : null}
                  </View>
                  <Pressable onPress={() => resolve(c.id)} style={styles.resolveBtn} testID={`resolve-${c.id}`}>
                    <Feather name="check" size={14} color={colors.onBrand} />
                    <Text style={styles.resolveTxt}>DONE</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.xl, fontFamily: font.body },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tableBox: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tableNum: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.onBrand },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  reasonLbl: { fontFamily: font.body, fontSize: 11, letterSpacing: 1.5, fontWeight: "800", color: colors.onSurface },
  tblLbl: { fontFamily: font.display, fontSize: 15, fontWeight: "800", color: colors.brand, marginTop: 2 },
  note: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  resolveBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm },
  resolveTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
});
