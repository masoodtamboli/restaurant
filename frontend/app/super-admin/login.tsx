import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

export default function SuperAdminLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("9999999999");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await store.getSuperAdminToken();
      if (t) router.replace("/super-admin/restaurants");
    })();
  }, []);

  const login = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await request<any>("/super-admin/login", { method: "POST", body: { phone, password } });
      await store.setSuperAdmin(r.token, r.super_admin);
      router.replace("/super-admin/restaurants");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} testID="sa-login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.head}>
          <Feather name="crosshair" size={30} color={colors.saffron} />
          <Text style={styles.title}>Platform Control</Text>
          <Text style={styles.sub}>Super Admin · Restricted access</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            style={styles.input}
            testID="sa-phone-input"
          />
          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            testID="sa-password-input"
          />
          {err && <Text style={styles.err}>{err}</Text>}
          <Pressable onPress={login} disabled={loading} style={styles.btn} testID="sa-login-btn">
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.btnTxt}>SIGN IN</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.lg },
  head: { alignItems: "center", marginTop: spacing.xxxl, marginBottom: spacing.xl, gap: 8 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: "800", color: colors.saffron },
  sub: { fontFamily: font.body, fontSize: 12, color: "#c9b58f", textAlign: "center", letterSpacing: 1 },
  card: { backgroundColor: "rgba(253,246,236,0.08)", padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(212,160,23,0.4)", ...shadow.card },
  label: { fontFamily: font.body, fontSize: 12, color: colors.saffron, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: font.body, color: colors.onSurface, fontSize: 15 },
  err: { color: "#ff8c7a", fontFamily: font.body, marginTop: spacing.sm },
  btn: { marginTop: spacing.lg, backgroundColor: colors.saffron, paddingVertical: 15, borderRadius: radius.sm, alignItems: "center" },
  btnTxt: { color: colors.onSaffron, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
});
