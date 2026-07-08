import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { request, store } from "@/src/api";

export default function OtpScreen() {
  const { table_id } = useLocalSearchParams<{ table_id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [table, setTable] = useState<any>(null);
  const cooldownRef = useRef<any>(null);

  useEffect(() => {
    if (!table_id) return;
    request<any>(`/tables/${table_id}`)
      .then(setTable)
      .catch(() => setErr("Ask staff for a new QR code — this one isn't valid."));
  }, [table_id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(cooldownRef.current);
  }, [cooldown]);

  const sendOtp = async () => {
    setErr(null);
    if (phone.length < 10) {
      setErr("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      await request("/auth/send-otp", { method: "POST", body: { phone, name } });
      setStep("otp");
      setCooldown(30);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setErr(null);
    if (otp.length !== 6) {
      setErr("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const r = await request<any>("/auth/verify-otp", {
        method: "POST",
        body: { phone, otp, table_id, name: name || undefined },
      });
      await store.setSession(r.token, r.user, r.table, r.table_session_id);
      router.replace("/menu");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} testID="otp-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="otp-back">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.hi}>WELCOME</Text>
          <Text style={styles.title}>Latur Tahari House</Text>
          {table && (
            <View style={styles.tableBadge} testID="table-badge">
              <Feather name="map-pin" size={14} color={colors.saffron} />
              <Text style={styles.tableBadgeTxt}>Table {table.table_number}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          {step === "phone" ? (
            <>
              <Text style={styles.label}>Your Name (optional)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Guest name"
                placeholderTextColor={colors.muted}
                style={styles.input}
                testID="name-input"
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.cc}><Text style={styles.ccTxt}>+91</Text></View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
                  placeholder="98XXX XXXXX"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  style={[styles.input, { flex: 1 }]}
                  testID="phone-input"
                />
              </View>
              {err && <Text style={styles.err}>{err}</Text>}
              <Pressable
                onPress={sendOtp}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                testID="send-otp-btn"
              >
                {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryTxt}>Send OTP</Text>}
              </Pressable>
              <Text style={styles.footNote}>By continuing you agree to session-based table binding for ordering.</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter the 6-digit code</Text>
              <Text style={styles.hint}>Sent to +91 {phone}. Dev mode: use <Text style={{ fontWeight: "800", color: colors.brand }}>123456</Text></Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="••••••"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.otpBox]}
                testID="otp-input"
              />
              {err && <Text style={styles.err}>{err}</Text>}
              <Pressable
                onPress={verify}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                testID="verify-otp-btn"
              >
                {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryTxt}>Verify & Continue</Text>}
              </Pressable>
              <Pressable
                onPress={cooldown > 0 ? undefined : sendOtp}
                disabled={cooldown > 0}
                style={styles.resend}
                testID="resend-otp"
              >
                <Text style={[styles.resendTxt, cooldown > 0 && { color: colors.muted }]}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  back: { padding: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm },
  header: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  hi: { color: colors.saffron, letterSpacing: 3, fontFamily: font.body, fontWeight: "700", fontSize: 11 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: "800", color: colors.brand, marginTop: 4 },
  tableBadge: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tableBadgeTxt: { color: colors.saffron, fontFamily: font.display, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  label: { fontFamily: font.body, fontSize: 12, color: colors.muted, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: font.body,
    color: colors.onSurface,
    fontSize: 16,
  },
  otpBox: { fontSize: 24, letterSpacing: 12, textAlign: "center", fontWeight: "800" },
  phoneRow: { flexDirection: "row", gap: spacing.sm },
  cc: { justifyContent: "center", paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  ccTxt: { fontFamily: font.body, fontSize: 16, color: colors.onSurface, fontWeight: "700" },
  err: { color: colors.error, marginTop: spacing.sm, fontFamily: font.body, fontSize: 13 },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  primaryTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  footNote: { marginTop: spacing.md, fontFamily: font.body, color: colors.muted, fontSize: 11, textAlign: "center" },
  hint: { fontFamily: font.body, fontSize: 13, color: colors.muted, marginBottom: spacing.md },
  resend: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  resendTxt: { color: colors.brand, fontFamily: font.body, fontWeight: "700" },
});
