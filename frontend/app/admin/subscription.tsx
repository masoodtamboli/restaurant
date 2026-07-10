import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminSubscription() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickedPlan, setPickedPlan] = useState<any | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const r = await request<any>("/admin/subscriptions/status", { token: tok });
      setData(r);
    } catch (e: any) {
      if (e.status === 401) router.replace("/admin/login");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach a payment screenshot.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const dataUri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setProof(dataUri);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!pickedPlan) { setErr("Pick a plan first"); return; }
    if (!proof) { setErr("Attach a payment screenshot"); return; }
    if (utr.trim().length < 4) { setErr("Enter your UTR / txn reference"); return; }
    setSubmitting(true);
    try {
      const tok = await store.getAdminToken();
      await request("/admin/subscriptions/request", { method: "POST", token: tok, body: {
        subscription_plan_id: pickedPlan.id,
        payment_proof_base64: proof,
        payment_reference: utr.trim(),
      }});
      setPickedPlan(null); setProof(null); setUtr("");
      load();
    } catch (e: any) { setErr(e.message); } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-subscription-screen">
      <AdminNav title="Subscription" subtitle={data?.days_left != null ? `${data.days_left} days remaining` : undefined} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
          {/* Current status */}
          <View style={[styles.statusCard, data?.active ? { backgroundColor: colors.success } : { backgroundColor: colors.error }]}>
            <Text style={styles.statusLbl}>CURRENT PLAN</Text>
            {data?.active ? (
              <>
                <Text style={styles.statusVal}>{data.active.plan_name} · ACTIVE</Text>
                <Text style={styles.statusSub}>Ends {new Date(data.active.end_date).toDateString()} · {data.days_left} days left</Text>
              </>
            ) : (
              <>
                <Text style={styles.statusVal}>NO ACTIVE PLAN</Text>
                <Text style={styles.statusSub}>Pick a plan and upload your payment screenshot.</Text>
              </>
            )}
          </View>

          <Text style={styles.section}>AVAILABLE PLANS</Text>
          <View style={styles.plansRow}>
            {(data?.plans || []).map((p: any) => (
              <Pressable
                key={p.id}
                onPress={() => setPickedPlan(p)}
                style={[styles.planCard, pickedPlan?.id === p.id && styles.planCardActive]}
                testID={`plan-${p.duration_days}`}
              >
                <Text style={styles.planName}>{p.plan_name}</Text>
                <Text style={styles.planPrice}>{rupee(p.price)}</Text>
                <Text style={styles.planDur}>{p.duration_days} days</Text>
                {pickedPlan?.id === p.id && <Feather name="check-circle" size={20} color={colors.saffron} style={{ marginTop: 6 }} />}
              </Pressable>
            ))}
          </View>

          {pickedPlan && (
            <View style={styles.payFlow}>
              <Text style={styles.section}>SCAN & PAY</Text>
              <View style={styles.qrBox}>
                <ExpoImage source={{ uri: pickedPlan.qr_image_url }} style={{ width: 220, height: 220 }} contentFit="contain" />
                <Text style={styles.payAmount}>{rupee(pickedPlan.price)}</Text>
                <Text style={styles.payHint}>Scan with any UPI app. Then upload the screenshot below.</Text>
              </View>

              <Text style={styles.section}>ATTACH PROOF</Text>
              <Pressable onPress={pickImage} style={styles.attachBtn} testID="attach-proof-btn">
                <Feather name={proof ? "check-circle" : "upload"} size={16} color={colors.brand} />
                <Text style={styles.attachTxt}>{proof ? "SCREENSHOT ATTACHED" : "UPLOAD SCREENSHOT"}</Text>
              </Pressable>
              {proof && (
                <ExpoImage source={{ uri: proof }} style={styles.proofPreview} contentFit="cover" />
              )}

              <Text style={styles.section}>UTR / TXN REFERENCE</Text>
              <TextInput
                value={utr}
                onChangeText={setUtr}
                placeholder="e.g. 405812345678"
                placeholderTextColor={colors.muted}
                style={styles.utrInput}
                testID="utr-input"
              />
              {err && <Text style={styles.err}>{err}</Text>}
              <Pressable
                onPress={submit}
                disabled={submitting}
                style={styles.submitBtn}
                testID="submit-sub-btn"
              >
                {submitting ? <ActivityIndicator color={colors.onBrand} /> : (
                  <Text style={styles.submitTxt}>SUBMIT FOR VERIFICATION</Text>
                )}
              </Pressable>
            </View>
          )}

          <Text style={[styles.section, { marginTop: spacing.xl }]}>HISTORY</Text>
          {(data?.history || []).length === 0 && <Text style={styles.empty}>No history yet.</Text>}
          {(data?.history || []).map((h: any) => (
            <View key={h.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hName}>{h.plan_name}</Text>
                <Text style={styles.hMeta}>{new Date(h.created_at).toDateString()} · UTR {h.payment_reference}</Text>
              </View>
              <View style={[styles.hBadge, statusBg(h.status)]}>
                <Text style={styles.hBadgeTxt}>{h.status.replace("_", " ").toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  statusCard: { padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, ...shadow.card },
  statusLbl: { fontFamily: font.body, letterSpacing: 2, fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: "800" },
  statusVal: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.onBrand, marginTop: 4 },
  statusSub: { fontFamily: font.body, color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 },
  section: { fontFamily: font.body, fontSize: 11, letterSpacing: 3, color: colors.brand, fontWeight: "800", marginBottom: spacing.sm, marginTop: spacing.md },
  plansRow: { flexDirection: "row", gap: spacing.sm },
  planCard: { flex: 1, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, alignItems: "center", ...shadow.card },
  planCardActive: { borderColor: colors.brand, backgroundColor: colors.surfaceTertiary },
  planName: { fontFamily: font.body, fontSize: 11, letterSpacing: 1, color: colors.muted, fontWeight: "800" },
  planPrice: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.brand, marginTop: 4 },
  planDur: { fontFamily: font.body, fontSize: 11, color: colors.muted },
  payFlow: { marginTop: spacing.md },
  qrBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  payAmount: { fontFamily: font.display, fontSize: 24, fontWeight: "800", color: colors.brand, marginTop: 8 },
  payHint: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 4, textAlign: "center" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surfaceTertiary, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed" },
  attachTxt: { fontFamily: font.display, fontWeight: "800", color: colors.brand, letterSpacing: 1.5, fontSize: 12 },
  proofPreview: { width: "100%", height: 180, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  utrInput: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontFamily: font.body, fontSize: 15, color: colors.onSurface },
  err: { color: colors.error, fontFamily: font.body, marginTop: 6 },
  submitBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.sm, alignItems: "center" },
  submitTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
  empty: { fontFamily: font.body, color: colors.muted, fontSize: 13 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  hName: { fontFamily: font.display, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  hMeta: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  hBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  hBadgeTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});
