import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

export default function Index() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableInput, setTableInput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [tok, tbl] = await Promise.all([store.getToken(), store.getTable()]);
        if (tok && tbl) { router.replace("/menu"); return; }
        const r = await request<any>("/restaurants/default");
        setRestaurant(r);
        await store.setRestaurant(r);
        const t = await request<any[]>(`/tables?restaurant_id=${r.id}`);
        setTables(t);
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const startTable = (tableId: string) => {
    router.push({ pathname: "/otp", params: { table_id: tableId, restaurant_id: restaurant?.id } });
  };

  const startByNumber = () => {
    const n = parseInt(tableInput.trim(), 10);
    const t = tables.find((x) => x.table_number === n);
    if (t) startTable(t.id);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="landing-screen">
      <View style={styles.hero}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=1200&q=80" }}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
        />
        <View style={styles.heroScrim} />
        <View style={styles.heroContent}>
          <Text style={styles.brandTag}>KONDHWA · PUNE</Text>
          <Text style={styles.brandTitle}>{restaurant?.name || "Latur\nTahari House"}</Text>
          <Text style={styles.brandSub}>Scan the QR on your table to begin</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottom}>
        <View style={styles.qrCard}>
          <View style={styles.qrRow}>
            <Feather name="camera" size={18} color={colors.brand} />
            <Text style={styles.qrTitle}>Simulate QR Scan (Dev)</Text>
          </View>
          <Text style={styles.hint}>Pick your table — this stands in for a real QR scan.</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={tableInput}
              onChangeText={setTableInput}
              placeholder="Table #"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.input}
              testID="table-number-input"
            />
            <Pressable onPress={startByNumber} style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.8 }]} testID="table-go-btn">
              <Text style={styles.goBtnTxt}>Go</Text>
            </Pressable>
          </View>

          <Text style={styles.orTxt}>OR TAP A TABLE</Text>

          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tablesRow}>
              {tables.map((t) => (
                <Pressable key={t.id} onPress={() => startTable(t.id)} style={({ pressed }) => [styles.tableChip, pressed && { opacity: 0.7 }]} testID={`table-chip-${t.table_number}`}>
                  <Text style={styles.tableChipNum}>{t.table_number}</Text>
                  <Text style={styles.tableChipLbl}>Table</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable onPress={() => router.push("/admin/login")} style={styles.adminLink} testID="admin-link">
            <Feather name="shield" size={14} color={colors.muted} />
            <Text style={styles.adminLinkTxt}>Restaurant Staff Login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 320, position: "relative" },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(43,24,16,0.55)" },
  heroContent: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  brandTag: { color: colors.saffron, fontFamily: font.body, fontSize: 11, letterSpacing: 3, marginBottom: spacing.sm, fontWeight: "700" },
  brandTitle: { color: colors.onBrand, fontFamily: font.display, fontSize: 42, fontWeight: "800", lineHeight: 46, letterSpacing: 0.5 },
  brandSub: { color: "#f2d9b0", marginTop: spacing.sm, fontFamily: font.body, fontSize: 14 },
  bottom: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, backgroundColor: colors.surface },
  qrCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  qrRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  qrTitle: { fontFamily: font.display, fontSize: 18, color: colors.onSurface, fontWeight: "800" },
  hint: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  inputRow: { flexDirection: "row", marginTop: spacing.md, gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: font.body, color: colors.onSurface, fontSize: 16 },
  goBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, justifyContent: "center", alignItems: "center", borderRadius: radius.sm },
  goBtnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 15 },
  orTxt: { marginTop: spacing.lg, letterSpacing: 2, color: colors.muted, fontSize: 10, fontFamily: font.body, fontWeight: "700" },
  tablesRow: { gap: spacing.sm, paddingVertical: spacing.md },
  tableChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center", minWidth: 68 },
  tableChipNum: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.brand },
  tableChipLbl: { fontFamily: font.body, fontSize: 10, color: colors.muted, letterSpacing: 1 },
  adminLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, alignSelf: "center" },
  adminLinkTxt: { color: colors.muted, fontFamily: font.body, fontSize: 12 },
});
