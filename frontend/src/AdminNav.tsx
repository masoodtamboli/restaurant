import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";
import { store } from "@/src/api";

const TABS = [
  { key: "queue", label: "Queue", icon: "list", path: "/admin/queue" },
  { key: "menu", label: "Menu", icon: "book-open", path: "/admin/menu" },
  { key: "tables", label: "Tables", icon: "grid", path: "/admin/tables" },
  { key: "sales", label: "Sales", icon: "trending-up", path: "/admin/sales" },
  { key: "customers", label: "Customers", icon: "users", path: "/admin/customers" },
];

export default function AdminNav({ title }: { title: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await store.clearAdminToken();
    router.replace("/admin/login");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>LATUR · ADMIN</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={logout} style={styles.logout} testID="admin-logout">
          <Feather name="log-out" size={16} color={colors.onBrand} />
          <Text style={styles.logoutTxt}>SIGN OUT</Text>
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
              testID={`admin-tab-${t.key}`}
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
  wrap: { backgroundColor: colors.brand, paddingBottom: spacing.sm },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  brand: { fontFamily: font.body, fontSize: 10, letterSpacing: 3, color: colors.saffron, fontWeight: "800" },
  title: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.onBrand, marginTop: 2 },
  logout: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm },
  logoutTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabsRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: radius.pill, flexShrink: 0, height: 36 },
  tabActive: { backgroundColor: colors.saffron },
  tabTxt: { color: colors.onBrand, fontFamily: font.body, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabTxtActive: { color: colors.onSaffron },
});
