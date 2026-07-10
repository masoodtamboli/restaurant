import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

const REASONS = [
  { key: "water", label: "Need water", icon: "droplet" as const },
  { key: "cutlery", label: "Need cutlery / napkins", icon: "coffee" as const },
  { key: "complaint", label: "Complaint / other", icon: "alert-triangle" as const },
];

export default function CallStaff() {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      const [tok, table] = await Promise.all([store.getToken(), store.getTable()]);
      await request("/staff-calls", { method: "POST", token: tok, body: { table_id: table.id, reason, note } });
      setDone(true);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]} testID="call-staff-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="call-back">
            <Feather name="arrow-left" size={22} color={colors.onBrand} />
          </Pressable>
          <Text style={styles.title}>Call Staff</Text>
          <View style={{ width: 30 }} />
        </View>

        {done ? (
          <View style={styles.doneWrap}>
            <View style={styles.doneCircle}><Feather name="check" size={40} color={colors.onBrand} /></View>
            <Text style={styles.doneTitle}>Staff Notified</Text>
            <Text style={styles.doneSub}>Someone will be with you shortly.</Text>
            <Pressable onPress={() => router.back()} style={styles.doneBtn} testID="call-done-btn">
              <Text style={styles.doneBtnTxt}>OK</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.label}>What do you need?</Text>
            {REASONS.map((r) => {
              const active = reason === r.key;
              return (
                <Pressable key={r.key} onPress={() => setReason(r.key)} style={[styles.reasonRow, active && styles.reasonRowActive]} testID={`reason-${r.key}`}>
                  <View style={[styles.reasonIcon, active && { backgroundColor: colors.saffron }]}>
                    <Feather name={r.icon} size={18} color={active ? colors.onSaffron : colors.brand} />
                  </View>
                  <Text style={[styles.reasonLbl, active && { color: colors.brand, fontWeight: "800" }]}>{r.label}</Text>
                  {active && <Feather name="check-circle" size={18} color={colors.brand} />}
                </Pressable>
              );
            })}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Add a note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything specific?"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.input}
              testID="note-input"
            />

            <Pressable
              onPress={submit}
              disabled={!reason || sending}
              style={[styles.submitBtn, !reason && { opacity: 0.5 }]}
              testID="send-call-btn"
            >
              {sending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.submitTxt}>NOTIFY STAFF</Text>}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { padding: spacing.xs },
  title: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 20, letterSpacing: 0.5 },
  body: { flex: 1, padding: spacing.lg },
  label: { fontFamily: font.body, fontSize: 12, color: colors.muted, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.border },
  reasonRowActive: { borderColor: colors.brand, backgroundColor: colors.surfaceTertiary },
  reasonIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  reasonLbl: { flex: 1, fontFamily: font.body, fontSize: 15, color: colors.onSurface, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 80, fontFamily: font.body, fontSize: 14, color: colors.onSurface, textAlignVertical: "top" },
  submitBtn: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.sm, alignItems: "center" },
  submitTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 15 },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  doneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", ...shadow.strong },
  doneTitle: { fontFamily: font.display, fontSize: 26, fontWeight: "800", color: colors.brand },
  doneSub: { fontFamily: font.body, color: colors.muted, textAlign: "center" },
  doneBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingHorizontal: spacing.xxl, paddingVertical: 14, borderRadius: radius.sm },
  doneBtnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
});
