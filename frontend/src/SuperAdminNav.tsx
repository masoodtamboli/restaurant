import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";
import { store } from "@/src/api";

const TABS = [
  { key: "restaurants", label: "Restaurants", icon: "home", path: "/super-admin/restaurants" },
  { key: "subscriptions", label: "Subscriptions", icon: "credit-card", path: "/super-admin/subscriptions" },
  { key: "plans", label: "Plans", icon: "package", path: "/super-admin/plans" },
];

export default function SuperAdminNav({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await store.clearSuperAdmin();
    router.replace("/super-admin/login");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>PLATFORM · SUPER ADMIN</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
        </View>
        <Pressable onPress={logout} style={styles.logout} testID="sa-logout">
          <Feather name="log-out" size={16} color={colors.onBrand} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map((t) => {
          const active = pathname === t.path;
          return (
            <Pressable
              key={t.key}
              onPress={() => router.replace(t.path as any)}
              style={[styles.tab, active && styles.tabActive]}
              testID={`sa-tab-${t.key}`}
            >
              <Feather name={t.icon as any} size={14} color={active ? colors.onSaffron : colors.onBrand} />
              <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{t.label.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceInverse, paddingBottom: spacing.sm },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  brand: { fontFamily: font.body, fontSize: 10, letterSpacing: 3, color: colors.saffron, fontWeight: "800" },
  title: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.onBrand, marginTop: 2 },
  sub: { fontFamily: font.body, fontSize: 11, color: "#c9b58f", marginTop: 2 },
  logout: { padding: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.sm },
  tabsRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill, flexShrink: 0, height: 36 },
  tabActive: { backgroundColor: colors.saffron },
  tabTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabTxtActive: { color: colors.onSaffron },
});
