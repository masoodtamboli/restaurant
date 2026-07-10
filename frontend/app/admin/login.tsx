import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

export default function AdminLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("8888888888");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await store.getAdminToken();
      if (t) router.replace("/admin/queue");
    })();
  }, []);

  const login = async () => {
    setErr(null);
    if (pin.length < 4 || pin.length > 6) { setErr("PIN must be 4–6 digits"); return; }
    setLoading(true);
    try {
      const r = await request<any>("/admin/login", { method: "POST", body: { phone, pin } });
      await store.setAdmin(r.token, r.admin);
      if (!r.subscription) router.replace("/admin/renew");
      else router.replace("/admin/queue");
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} testID="admin-login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={() => router.replace("/")} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.head}>
          <Feather name="shield" size={28} color={colors.brand} />
          <Text style={styles.title}>Owner Login</Text>
          <Text style={styles.sub}>Latur Tahari House · Dashboard</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.cc}><Text style={styles.ccTxt}>+91</Text></View>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
              placeholder="98XXX XXXXX"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={[styles.input, { flex: 1 }]}
              testID="admin-phone"
            />
          </View>
          <Text style={[styles.label, { marginTop: spacing.md }]}>PIN (4–6 digits)</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="••••"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            style={[styles.input, styles.pinBox]}
            testID="admin-pin"
          />
          {err && <Text style={styles.err}>{err}</Text>}
          <Pressable onPress={login} disabled={loading} style={styles.btn} testID="admin-login-btn">
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.btnTxt}>SIGN IN</Text>}
          </Pressable>
          <Text style={styles.hint}>Default: phone 8888888888 · PIN 1234</Text>
          <Text style={styles.footNote}>Locked out? Contact the platform super admin for a PIN reset.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  back: { padding: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm },
  head: { alignItems: "center", marginVertical: spacing.xl, gap: 6 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: "800", color: colors.brand },
  sub: { fontFamily: font.body, fontSize: 12, color: colors.muted, textAlign: "center" },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  label: { fontFamily: font.body, fontSize: 12, color: colors.muted, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  phoneRow: { flexDirection: "row", gap: spacing.sm },
  cc: { justifyContent: "center", paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  ccTxt: { fontFamily: font.body, fontSize: 16, color: colors.onSurface, fontWeight: "700" },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: font.body, color: colors.onSurface, fontSize: 15 },
  pinBox: { fontSize: 24, letterSpacing: 12, textAlign: "center", fontWeight: "800" },
  err: { color: colors.error, fontFamily: font.body, marginTop: spacing.sm },
  btn: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingVertical: 15, borderRadius: radius.sm, alignItems: "center" },
  btnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
  hint: { fontFamily: font.body, color: colors.muted, fontSize: 11, textAlign: "center", marginTop: spacing.md },
  footNote: { fontFamily: font.body, color: colors.muted, fontSize: 10, textAlign: "center", marginTop: spacing.xs, fontStyle: "italic" },
});
