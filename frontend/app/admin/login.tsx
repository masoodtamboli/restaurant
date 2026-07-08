import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@latur.com");
  const [password, setPassword] = useState("admin123");
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
    setLoading(true);
    try {
      const r = await request<any>("/admin/login", { method: "POST", body: { email, password } });
      await store.setAdminToken(r.token);
      router.replace("/admin/queue");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} testID="admin-login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={() => router.replace("/")} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.head}>
          <Feather name="shield" size={28} color={colors.brand} />
          <Text style={styles.title}>Staff Login</Text>
          <Text style={styles.sub}>Latur Tahari House · Kitchen & Floor Dashboard</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            testID="admin-email"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            testID="admin-password"
          />
          {err && <Text style={styles.err}>{err}</Text>}
          <Pressable onPress={login} disabled={loading} style={styles.btn} testID="admin-login-btn">
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.btnTxt}>SIGN IN</Text>}
          </Pressable>
          <Text style={styles.hint}>Default: admin@latur.com / admin123</Text>
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
  label: { fontFamily: font.body, fontSize: 12, color: colors.muted, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: font.body, color: colors.onSurface, fontSize: 15 },
  err: { color: colors.error, fontFamily: font.body, marginTop: spacing.sm },
  btn: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingVertical: 15, borderRadius: radius.sm, alignItems: "center" },
  btnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
  hint: { fontFamily: font.body, color: colors.muted, fontSize: 11, textAlign: "center", marginTop: spacing.md },
});
