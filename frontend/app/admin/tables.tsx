import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminTables() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState<any | null>(null);
  const [newNum, setNewNum] = useState("");

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    const t = await request<any[]>("/admin/tables", { token: tok });
    setTables(t);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (t: any) => {
    const tok = await store.getAdminToken();
    await request(`/admin/tables/${t.id}`, { method: "PATCH", token: tok, body: { is_active: !t.is_active } });
    load();
  };

  const add = async () => {
    const n = parseInt(newNum.trim(), 10);
    if (!n) return;
    const tok = await store.getAdminToken();
    try {
      await request("/admin/tables", { method: "POST", token: tok, body: { table_number: n } });
      setNewNum("");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const qrPngUrl = (t: any) =>
    // Public QR code generator. Encodes the deep-link so a real scan opens the app.
    `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(t.qr_code_url)}&size=400x400&margin=20&color=7A1F2B&bgcolor=FDF6EC`;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-tables-screen">
      <AdminNav title="Tables & QR Codes" />
      <View style={styles.addBar}>
        <TextInput value={newNum} onChangeText={setNewNum} placeholder="Table #" keyboardType="numeric" style={styles.numInput} testID="new-table-num" />
        <Pressable onPress={add} style={styles.addBtn} testID="add-table-btn">
          <Feather name="plus" size={16} color={colors.onBrand} />
          <Text style={styles.addTxt}>ADD TABLE</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={styles.grid}>
            {tables.map((t) => (
              <View key={t.id} style={[styles.tCard, !t.is_active && { opacity: 0.55 }]} testID={`table-card-${t.table_number}`}>
                <Text style={styles.tNum}>{t.table_number}</Text>
                <Text style={styles.tLbl}>TABLE</Text>
                <View style={styles.tActions}>
                  <Pressable onPress={() => setShowQR(t)} style={styles.tActionBtn} testID={`show-qr-${t.table_number}`}>
                    <Feather name="grid" size={14} color={colors.brand} />
                    <Text style={styles.tActionTxt}>QR</Text>
                  </Pressable>
                  <Pressable onPress={() => toggle(t)} style={[styles.tActionBtn, { backgroundColor: t.is_active ? colors.success : colors.error }]} testID={`toggle-${t.table_number}`}>
                    <Feather name={t.is_active ? "check" : "x"} size={14} color={colors.onBrand} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal visible={!!showQR} transparent animationType="fade" onRequestClose={() => setShowQR(null)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <View style={styles.qrHead}>
              <View>
                <Text style={styles.qrTitle}>Table {showQR?.table_number}</Text>
                <Text style={styles.qrSub}>Print & stick on the table</Text>
              </View>
              <Pressable onPress={() => setShowQR(null)}><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            {showQR && (
              <View style={styles.qrImgWrap}>
                {/* Using expo-image for network QR */}
                <View style={{ width: 280, height: 280, backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>
                  <QRImage url={qrPngUrl(showQR)} />
                </View>
                <Text style={styles.qrLink} numberOfLines={2}>{showQR.qr_code_url}</Text>
                <Text style={styles.qrHint}>Guests scan → phone OTP → straight to menu, bound to this table.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function QRImage({ url }: { url: string }) {
  return <ExpoImage source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="contain" />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  addBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, alignItems: "center" },
  numInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, color: colors.onSurface },
  addBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tCard: { width: "31%", backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, ...shadow.card },
  tNum: { fontFamily: font.display, fontSize: 30, fontWeight: "800", color: colors.brand },
  tLbl: { fontFamily: font.body, fontSize: 9, letterSpacing: 2, color: colors.muted, fontWeight: "800" },
  tActions: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
  tActionBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  tActionTxt: { fontFamily: font.body, fontSize: 10, fontWeight: "800", color: colors.brand },
  qrOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  qrCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: colors.border },
  qrHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  qrTitle: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.brand },
  qrSub: { fontFamily: font.body, fontSize: 12, color: colors.muted },
  qrImgWrap: { alignItems: "center", gap: spacing.md },
  qrLink: { fontFamily: font.body, fontSize: 11, color: colors.muted, textAlign: "center" },
  qrHint: { fontFamily: font.body, fontSize: 12, color: colors.onSurface, textAlign: "center" },
});
