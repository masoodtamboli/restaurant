import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import SuperAdminNav from "@/src/SuperAdminNav";

export default function SASubscriptions() {
  const router = useRouter();
  const [pending, setPending] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    const tok = await store.getSuperAdminToken();
    if (!tok) { router.replace("/super-admin/login"); return; }
    try {
      const [p, a] = await Promise.all([
        request<any[]>("/super-admin/subscriptions/pending", { token: tok }),
        request<any[]>("/super-admin/subscriptions/all", { token: tok }),
      ]);
      setPending(p); setAll(a);
    } catch (e: any) {
      if (e.status === 401) router.replace("/super-admin/login");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (sid: string, action: "approve" | "reject") => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      await request(`/super-admin/subscriptions/${sid}/${action}`, { method: "POST", token: tok });
      load();
    } finally { setBusy(false); }
  };

  const list = tab === "pending" ? pending : all;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="sa-subscriptions-screen">
      <SuperAdminNav title="Subscriptions" subtitle={`${pending.length} pending approval`} />
      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab("pending")} style={[styles.tab, tab === "pending" && styles.tabActive]} testID="sa-sub-tab-pending">
          <Text style={[styles.tabTxt, tab === "pending" && styles.tabTxtActive]}>PENDING · {pending.length}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("all")} style={[styles.tab, tab === "all" && styles.tabActive]} testID="sa-sub-tab-all">
          <Text style={[styles.tabTxt, tab === "all" && styles.tabTxtActive]}>ALL · {all.length}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {list.length === 0 && <Text style={styles.empty}>{tab === "pending" ? "No pending requests." : "No subscriptions yet."}</Text>}
          {list.map((s: any) => (
            <View key={s.id} style={styles.card} testID={`sub-${s.id}`}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rName}>{s.restaurant_name}</Text>
                  <Text style={styles.plan}>{s.plan_name} · {rupee(s.amount_paid)}</Text>
                  <Text style={styles.meta}>UTR: {s.payment_reference}</Text>
                  <Text style={styles.meta}>{new Date(s.created_at).toLocaleString()}</Text>
                </View>
                <View style={[styles.pill, statusBg(s.status)]}>
                  <Text style={styles.pillTxt}>{s.status.replace("_", " ").toUpperCase()}</Text>
                </View>
              </View>
              {s.payment_proof_base64 && (
                <Pressable onPress={() => setProof(s.payment_proof_base64)} style={styles.proofBtn} testID={`view-proof-${s.id}`}>
                  <Feather name="image" size={14} color={colors.brand} />
                  <Text style={styles.proofTxt}>VIEW PAYMENT PROOF</Text>
                </Pressable>
              )}
              {s.status === "pending_verification" && (
                <View style={styles.actions}>
                  <Pressable disabled={busy} onPress={() => decide(s.id, "reject")} style={[styles.actBtn, { backgroundColor: colors.error }]} testID={`reject-${s.id}`}>
                    <Feather name="x" size={14} color={colors.onBrand} />
                    <Text style={styles.actTxt}>REJECT</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => decide(s.id, "approve")} style={[styles.actBtn, { backgroundColor: colors.success }]} testID={`approve-${s.id}`}>
                    <Feather name="check" size={14} color={colors.onBrand} />
                    <Text style={styles.actTxt}>APPROVE</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!proof} transparent onRequestClose={() => setProof(null)}>
        <Pressable style={styles.imgOverlay} onPress={() => setProof(null)}>
          <ExpoImage source={{ uri: proof || "" }} style={{ width: "90%", height: "70%" }} contentFit="contain" />
          <Text style={styles.tapClose}>Tap to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const statusBg = (s: string) => {
  if (s === "active") return { backgroundColor: colors.success };
  if (s === "rejected") return { backgroundColor: colors.error };
  if (s === "pending_verification") return { backgroundColor: colors.saffron };
  return { backgroundColor: colors.muted };
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  tabRow: { flexDirection: "row", gap: 8, padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  tabActive: { backgroundColor: colors.brand },
  tabTxt: { fontFamily: font.body, fontSize: 12, fontWeight: "800", color: colors.muted, letterSpacing: 1 },
  tabTxtActive: { color: colors.onBrand },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.xl, fontFamily: font.body },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rName: { fontFamily: font.display, fontSize: 16, fontWeight: "800", color: colors.brand },
  plan: { fontFamily: font.display, fontSize: 14, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  meta: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  pillTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  proofBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, alignSelf: "flex-start" },
  proofTxt: { fontFamily: font.body, fontWeight: "800", color: colors.brand, fontSize: 11, letterSpacing: 1 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.sm },
  actTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 12 },
  imgOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  tapClose: { color: colors.saffron, fontFamily: font.body, marginTop: spacing.md, letterSpacing: 2, fontSize: 12 },
});
