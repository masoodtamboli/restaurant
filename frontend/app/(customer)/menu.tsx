import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store, CartLine } from "@/src/api";

export default function Menu() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Popular");
  const [cartCount, setCartCount] = useState(0);
  const [table, setTable] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);

  const load = useCallback(async () => {
    const [menu, tbl] = await Promise.all([request("/menu"), store.getTable()]);
    setData(menu);
    setTable(tbl);
    if (tbl?.id) {
      try {
        const s = await request<any>(`/sessions/active/${tbl.id}`);
        setActiveSession(s);
      } catch {}
    }
    const cart = await store.getCart();
    setCartCount(cart.reduce((n, l) => n + l.qty, 0));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    (async () => {
      const tok = await store.getToken();
      if (!tok) router.replace("/");
    })();
  }, []);

  const categories = useMemo(() => {
    if (!data) return [] as string[];
    return ["Popular", ...Object.keys(data.categories)];
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [] as any[];
    if (activeCat === "Popular") return data.popular;
    return data.categories[activeCat] || [];
  }, [data, activeCat]);

  const addToCart = async (p: any) => {
    const cart = await store.getCart();
    const idx = cart.findIndex((l) => l.product_id === p.id);
    if (idx >= 0) cart[idx].qty += 1;
    else cart.push({ product_id: p.id, name: p.name, qty: 1, price: p.price, image_url: p.image_url, is_veg: p.is_veg });
    await store.setCart(cart);
    setCartCount(cart.reduce((n, l) => n + l.qty, 0));
  };

  const activeOrdersCount = activeSession?.orders?.filter((o: any) => o.status !== "completed").length || 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.wrap}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="menu-screen">
      {/* Sticky header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTag}>LATUR TAHARI HOUSE</Text>
          <Text style={styles.headerTitle}>Menu</Text>
        </View>
        <View style={styles.headerRight}>
          {table && (
            <View style={styles.tableBadge}>
              <Feather name="map-pin" size={12} color={colors.saffron} />
              <Text style={styles.tableBadgeTxt}>TABLE {table.table_number}</Text>
            </View>
          )}
          <Pressable
            onPress={async () => { await store.clearSession(); router.replace("/"); }}
            style={styles.iconBtn}
            testID="logout-btn"
          >
            <Feather name="log-out" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </View>

      {/* Category chips */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
        >
          {categories.map((c) => {
            const active = c === activeCat;
            return (
              <Pressable
                key={c}
                onPress={() => setActiveCat(c)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`cat-chip-${c}`}
              >
                {c === "Popular" && <Feather name="star" size={12} color={active ? colors.onSaffron : colors.brand} />}
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
            style={styles.itemCard}
            testID={`menu-item-${item.id}`}
          >
            <Image source={{ uri: item.image_url }} style={styles.itemImg} contentFit="cover" transition={200} />
            <View style={styles.itemBody}>
              <View style={styles.vegRow}>
                <View style={[styles.vegDotOuter, { borderColor: item.is_veg ? colors.success : colors.error }]}>
                  <View style={[styles.vegDot, { backgroundColor: item.is_veg ? colors.success : colors.error }]} />
                </View>
                {item.is_popular && (
                  <View style={styles.popTag}>
                    <Feather name="star" size={10} color={colors.onSaffron} />
                    <Text style={styles.popTxt}>POPULAR</Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{rupee(item.price)}</Text>
                <Pressable
                  onPress={() => addToCart(item)}
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
                  testID={`add-btn-${item.id}`}
                >
                  <Feather name="plus" size={16} color={colors.onBrand} />
                  <Text style={styles.addTxt}>ADD</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.muted, marginTop: spacing.xl }}>No items in this category.</Text>}
      />

      {/* Live status bar (if there's an active round) */}
      {activeOrdersCount > 0 && (
        <Pressable
          onPress={() => router.push("/tracking")}
          style={styles.liveBar}
          testID="live-status-bar"
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveTxt}>{activeOrdersCount} round{activeOrdersCount > 1 ? "s" : ""} in the kitchen</Text>
          <Feather name="chevron-right" size={18} color={colors.saffron} />
        </Pressable>
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => router.push("/cart")}
          style={[styles.fabCart, activeOrdersCount > 0 && { bottom: 88 }]}
          testID="cart-fab"
        >
          <Feather name="shopping-bag" size={18} color={colors.onBrand} />
          <Text style={styles.fabTxt}>View Cart</Text>
          <View style={styles.fabBadge}><Text style={styles.fabBadgeTxt}>{cartCount}</Text></View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTag: { color: colors.saffron, letterSpacing: 2, fontSize: 10, fontFamily: font.body, fontWeight: "700" },
  headerTitle: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 22 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  tableBadgeTxt: { color: colors.saffron, fontFamily: font.display, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  iconBtn: { padding: 6 },
  chipRow: { height: 56, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: "center" },
  chipContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  chipTxt: { fontFamily: font.body, fontSize: 13, color: colors.onSurface, fontWeight: "700" },
  chipTxtActive: { color: colors.onSaffron },
  itemCard: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  itemImg: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  itemBody: { flex: 1, marginLeft: spacing.md, justifyContent: "space-between" },
  vegRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vegDotOuter: { width: 14, height: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  popTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.saffron, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  popTxt: { fontSize: 9, fontFamily: font.body, fontWeight: "800", color: colors.onSaffron, letterSpacing: 0.5 },
  itemName: { fontFamily: font.display, fontWeight: "800", fontSize: 16, color: colors.onSurface, marginTop: 4 },
  itemDesc: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  price: { fontFamily: font.display, fontWeight: "800", fontSize: 17, color: colors.brand },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  fabCart: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 20,
    backgroundColor: colors.surfaceInverse,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadow.strong,
  },
  fabTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  fabBadge: { backgroundColor: colors.saffron, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fabBadgeTxt: { color: colors.onSaffron, fontFamily: font.display, fontWeight: "800", fontSize: 12 },
  liveBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 20,
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.strong,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.saffron },
  liveTxt: { flex: 1, color: colors.onBrand, fontFamily: font.body, fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
});
