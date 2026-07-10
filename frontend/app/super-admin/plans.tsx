import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import SuperAdminNav from "@/src/SuperAdminNav";

export default function SAPlans() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const tok = await store.getSuperAdminToken();
    if (!tok) { router.replace("/super-admin/login"); return; }
    try {
      const p = await request<any[]>("/super-admin/plans", { token: tok });
      setPlans(p);
    } catch (e: any) {
      if (e.status === 401) router.replace("/super-admin/login");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      const body = {
        plan_name: editing.plan_name,
        duration_days: Number(editing.duration_days),
        price: Number(editing.price),
        qr_image_url: editing.qr_image_url || "",
        is_active: editing.is_active !== false,
      };
      if (editing.id) {
        await request(`/super-admin/plans/${editing.id}`, { method: "PATCH", token: tok, body });
      } else {
        await request("/super-admin/plans", { method: "POST", token: tok, body });
      }
      setEditing(null); load();
    } finally { setBusy(false); }
  };

  const toggle = async (p: any) => {
    setBusy(true);
    try {
      const tok = await store.getSuperAdminToken();
      await request(`/super-admin/plans/${p.id}`, { method: "PATCH", token: tok, body: { is_active: !p.is_active } });
      load();
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="sa-plans-screen">
      <SuperAdminNav title="Subscription Plans" subtitle={`${plans.length} plans configured`} />
      <View style={styles.addRow}>
        <Pressable
          onPress={() => setEditing({ plan_name: "", duration_days: "30", price: "0", is_active: true })}
          style={styles.addBtn}
          testID="add-plan-btn"
        >
          <Feather name="plus" size={14} color={colors.onBrand} />
          <Text style={styles.addTxt}>NEW PLAN</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {plans.map((p) => (
            <View key={p.id} style={[styles.card, !p.is_active && { opacity: 0.55 }]} testID={`plan-${p.id}`}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.plan_name}</Text>
                  <Text style={styles.price}>{rupee(p.price)} · {p.duration_days} days</Text>
                </View>
                <View style={styles.qrThumb}>
                  {p.qr_image_url ? (
                    <ExpoImage source={{ uri: p.qr_image_url }} style={{ width: 80, height: 80 }} contentFit="contain" />
                  ) : (
                    <Feather name="image" size={24} color={colors.muted} />
                  )}
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => setEditing({ ...p, duration_days: String(p.duration_days), price: String(p.price) })} style={styles.editBtn} testID={`edit-plan-${p.id}`}>
                  <Feather name="edit-2" size={12} color={colors.brand} />
                  <Text style={styles.editTxt}>EDIT</Text>
                </Pressable>
                <Pressable onPress={() => toggle(p)} disabled={busy} style={[styles.editBtn, p.is_active ? { borderColor: colors.error } : { borderColor: colors.success }]} testID={`toggle-plan-${p.id}`}>
                  <Feather name={p.is_active ? "eye-off" : "eye"} size={12} color={p.is_active ? colors.error : colors.success} />
                  <Text style={[styles.editTxt, { color: p.is_active ? colors.error : colors.success }]}>{p.is_active ? "HIDE" : "SHOW"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{editing?.id ? "Edit Plan" : "New Plan"}</Text>
              <Pressable onPress={() => setEditing(null)}><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <TextInput placeholder="Plan Name" value={editing?.plan_name ?? ""} onChangeText={(v) => setEditing({ ...editing, plan_name: v })} style={styles.mInput} testID="plan-name" />
            <TextInput placeholder="Duration (days)" value={String(editing?.duration_days ?? "")} keyboardType="numeric" onChangeText={(v) => setEditing({ ...editing, duration_days: v.replace(/[^0-9]/g, "") })} style={styles.mInput} testID="plan-days" />
            <TextInput placeholder="Price (₹)" value={String(editing?.price ?? "")} keyboardType="numeric" onChangeText={(v) => setEditing({ ...editing, price: v.replace(/[^0-9.]/g, "") })} style={styles.mInput} testID="plan-price" />
            <TextInput placeholder="Custom QR URL (leave blank for auto-generate)" value={editing?.qr_image_url ?? ""} onChangeText={(v) => setEditing({ ...editing, qr_image_url: v })} style={styles.mInput} testID="plan-qr" />
            <Text style={styles.hint}>Leave QR blank to auto-generate a UPI QR from the price.</Text>
            <Pressable disabled={busy || !editing?.plan_name} onPress={save} style={styles.saveBtn} testID="save-plan-btn">
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveTxt}>SAVE</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  addRow: { padding: spacing.md, alignItems: "flex-end" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 1, fontSize: 12 },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...shadow.card },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.brand },
  price: { fontFamily: font.display, fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  qrThumb: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.brand },
  editTxt: { color: colors.brand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontFamily: font.display, fontSize: 18, fontWeight: "800", color: colors.brand },
  mInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, fontFamily: font.body, fontSize: 14, marginBottom: 10, color: colors.onSurface },
  hint: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginBottom: spacing.md, fontStyle: "italic" },
  saveBtn: { backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.sm, alignItems: "center" },
  saveTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
});
