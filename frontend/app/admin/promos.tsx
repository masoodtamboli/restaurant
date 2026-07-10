import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminPromos() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [sends, setSends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try {
      const [t, s] = await Promise.all([
        request<any[]>("/admin/promo-templates", { token: tok }),
        request<any[]>("/admin/promos/sends", { token: tok }),
      ]);
      setTemplates(t);
      setSends(s);
    } catch (e: any) {
      if (e.status === 401) router.replace("/admin/login");
      else if (e.status === 402) router.replace("/admin/renew");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = (t: any) => {
    setSelected(t);
    const v: Record<string, string> = {};
    (t.variable_fields || []).forEach((f: string) => (v[f] = ""));
    setVars(v);
  };

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const tok = await store.getAdminToken();
      const r = await request<any>("/admin/promos/send", { method: "POST", token: tok, body: { promo_template_id: selected.id, filled_variables: vars } });
      setFlash(`Sent to ${r.recipient_count} customer${r.recipient_count === 1 ? "" : "s"} (mock)`);
      setSelected(null);
      setVars({});
      load();
      setTimeout(() => setFlash(null), 4000);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-promos-screen">
      <AdminNav title="WhatsApp Promos" subtitle="Broadcast pre-approved templates" />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {flash && (
            <View style={styles.flash} testID="promo-sent-flash">
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.flashTxt}>{flash}</Text>
            </View>
          )}

          <Text style={styles.section}>PICK A TEMPLATE</Text>
          {templates.length === 0 && <Text style={styles.empty}>No approved templates yet.</Text>}
          {templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => pick(t)}
              style={[styles.tplCard, selected?.id === t.id && { borderColor: colors.brand, borderWidth: 2 }]}
              testID={`template-${t.id}`}
            >
              <View style={styles.tplHead}>
                <View style={styles.wa}><Feather name="send" size={14} color={colors.onBrand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tplName}>{t.template_name}</Text>
                  <Text style={styles.tplMeta}>Meta ID: {t.whatsapp_template_id}</Text>
                </View>
                {selected?.id === t.id && <Feather name="check-circle" size={20} color={colors.brand} />}
              </View>
              {t.variable_fields?.length > 0 && (
                <Text style={styles.varsHint}>Variables: {t.variable_fields.join(", ")}</Text>
              )}
            </Pressable>
          ))}

          {selected && (
            <View style={styles.composer}>
              <Text style={styles.section}>FILL IN VARIABLES</Text>
              {(selected.variable_fields || []).map((f: string) => (
                <View key={f} style={styles.varRow}>
                  <Text style={styles.varLbl}>{f.replace(/_/g, " ").toUpperCase()}</Text>
                  <TextInput
                    value={vars[f] || ""}
                    onChangeText={(v) => setVars({ ...vars, [f]: v })}
                    placeholder={`e.g. ${f.includes("percent") ? "20%" : f.includes("window") ? "5-7pm today" : "value"}`}
                    placeholderTextColor={colors.muted}
                    style={styles.varInput}
                    testID={`var-${f}`}
                  />
                </View>
              ))}
              <Pressable
                onPress={send}
                disabled={sending}
                style={styles.sendBtn}
                testID="send-promo-btn"
              >
                {sending ? <ActivityIndicator color={colors.onBrand} /> : (
                  <>
                    <Feather name="send" size={14} color={colors.onBrand} />
                    <Text style={styles.sendTxt}>BROADCAST TO OPTED-IN CUSTOMERS</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <Text style={[styles.section, { marginTop: spacing.xl }]}>SEND HISTORY</Text>
          {sends.length === 0 && <Text style={styles.empty}>No sends yet.</Text>}
          {sends.map((s) => (
            <View key={s.id} style={styles.sendRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sendTitle}>Template · {s.promo_template_id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.sendMeta}>{new Date(s.sent_at).toLocaleString()}</Text>
              </View>
              <View style={styles.recipCol}>
                <Text style={styles.recipNum}>{s.recipient_count}</Text>
                <Text style={styles.recipLbl}>SENT</Text>
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
  flash: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E5F1E4", padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.success },
  flashTxt: { fontFamily: font.body, color: colors.success, fontWeight: "700", fontSize: 13 },
  section: { fontFamily: font.body, fontSize: 11, letterSpacing: 3, color: colors.brand, fontWeight: "800", marginBottom: spacing.sm, marginTop: spacing.sm },
  empty: { fontFamily: font.body, color: colors.muted, marginBottom: spacing.md, fontSize: 13 },
  tplCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, ...shadow.card },
  tplHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  wa: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  tplName: { fontFamily: font.display, fontSize: 15, fontWeight: "800", color: colors.onSurface },
  tplMeta: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  varsHint: { fontFamily: font.body, fontSize: 11, color: colors.brand, marginTop: 6, fontStyle: "italic" },
  composer: { marginTop: spacing.lg, backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.saffron },
  varRow: { marginBottom: spacing.sm },
  varLbl: { fontFamily: font.body, fontSize: 10, letterSpacing: 1.5, color: colors.muted, fontWeight: "800", marginBottom: 4 },
  varInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, fontSize: 14, color: colors.onSurface },
  sendBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.sm, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  sendTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 1.5, fontSize: 12 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sendTitle: { fontFamily: font.display, fontSize: 13, fontWeight: "800", color: colors.onSurface },
  sendMeta: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  recipCol: { alignItems: "center" },
  recipNum: { fontFamily: font.display, fontSize: 20, fontWeight: "800", color: colors.brand },
  recipLbl: { fontFamily: font.body, fontSize: 9, letterSpacing: 1, color: colors.muted, fontWeight: "700" },
});
