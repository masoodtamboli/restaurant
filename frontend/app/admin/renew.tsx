import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { store } from "@/src/api";

export default function AdminRenew() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.wrap} testID="admin-renew-screen">
      <View style={styles.body}>
        <View style={styles.icon}><Feather name="clock" size={40} color={colors.onSaffron} /></View>
        <Text style={styles.title}>Renew to Continue</Text>
        <Text style={styles.sub}>
          Your subscription has expired. Customer ordering is still live — you just can&apos;t manage the dashboard
          until you renew. Pick a plan and upload your payment proof to reactivate.
        </Text>
        <Pressable
          onPress={() => router.replace("/admin/subscription")}
          style={styles.btn}
          testID="renew-cta"
        >
          <Feather name="credit-card" size={16} color={colors.onBrand} />
          <Text style={styles.btnTxt}>OPEN SUBSCRIPTION</Text>
        </Pressable>
        <Pressable
          onPress={async () => { await store.clearAdmin(); router.replace("/admin/login"); }}
          style={styles.altBtn}
          testID="renew-logout"
        >
          <Text style={styles.altTxt}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  body: { alignItems: "center", gap: spacing.md, maxWidth: 380 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.saffron, alignItems: "center", justifyContent: "center", ...shadow.strong },
  title: { fontFamily: font.display, fontSize: 28, fontWeight: "800", color: colors.brand },
  sub: { fontFamily: font.body, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.sm, marginTop: spacing.sm },
  btnTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 14 },
  altBtn: { marginTop: spacing.sm, padding: 10 },
  altTxt: { fontFamily: font.body, color: colors.muted, fontWeight: "700" },
});
