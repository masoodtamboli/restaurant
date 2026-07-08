import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store, CartLine } from "@/src/api";

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [upsells, setUpsells] = useState<any[]>([]);
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await store.getCart();
    setCart(c);
    // Show upsells if no sides/beverages
    const categoriesInCart = new Set(c.map((l) => l.name));
    try {
      const m = await request<any>("/menu");
      const suggestions = [...(m.categories["Sides"] || []), ...(m.categories["Beverages"] || [])].slice(0, 6);
      const filtered = suggestions.filter((p: any) => !c.find((l) => l.product_id === p.id));
      setUpsells(filtered);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setQty = async (idx: number, delta: number) => {
    const next = [...cart];
    next[idx].qty += delta;
    if (next[idx].qty <= 0) next.splice(idx, 1);
    setCart(next);
    await store.setCart(next);
  };

  const addUpsell = async (p: any) => {
    const next = [...cart];
    const idx = next.findIndex((l) => l.product_id === p.id);
    if (idx >= 0) next[idx].qty += 1;
    else next.push({ product_id: p.id, name: p.name, qty: 1, price: p.price, image_url: p.image_url, is_veg: p.is_veg });
    setCart(next);
    await store.setCart(next);
  };

  const total = cart.reduce((s, l) => s + l.qty * l.price, 0);

  const place = async () => {
    setErr(null);
    setPlacing(true);
    try {
      const [tok, table] = await Promise.all([store.getToken(), store.getTable()]);
      const order = await request<any>("/orders", {
        method: "POST",
        token: tok,
        body: {
          table_id: table.id,
          items: cart.map((l) => ({ product_id: l.product_id, qty: l.qty, spice_level: l.spice_level, note: l.note })),
        },
      });
      await store.clearCart();
      router.replace({ pathname: "/tracking", params: { justPlaced: order.id } });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setPlacing(false);
    }
  };

  const hasOnlyMains = cart.length > 0 && cart.every((l) => !["Sides", "Beverages", "Rotis"].includes((l as any).category || ""));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="cart-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="cart-back">
          <Feather name="arrow-left" size={22} color={colors.onBrand} />
        </Pressable>
        <Text style={styles.title}>Your Cart</Text>
        <View style={{ width: 30 }} />
      </View>

      {cart.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-bag" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptyHint}>Browse the menu and add a few dishes.</Text>
          <Pressable onPress={() => router.replace("/menu")} style={styles.exploreBtn}>
            <Text style={styles.exploreTxt}>EXPLORE MENU</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
          {cart.map((line, idx) => (
            <View key={idx} style={styles.line} testID={`cart-line-${line.product_id}`}>
              <Image source={{ uri: line.image_url }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.vegRow}>
                  <View style={[styles.vegDotOuter, { borderColor: line.is_veg ? colors.success : colors.error }]}>
                    <View style={[styles.vegDot, { backgroundColor: line.is_veg ? colors.success : colors.error }]} />
                  </View>
                  {line.spice_level && <Text style={styles.spiceTag}>{line.spice_level}</Text>}
                </View>
                <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
                <Text style={styles.linePrice}>{rupee(line.price)}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable onPress={() => setQty(idx, -1)} style={styles.stepBtn} testID={`dec-${line.product_id}`}>
                  <Feather name="minus" size={14} color={colors.brand} />
                </Pressable>
                <Text style={styles.stepQty}>{line.qty}</Text>
                <Pressable onPress={() => setQty(idx, 1)} style={styles.stepBtn} testID={`inc-${line.product_id}`}>
                  <Feather name="plus" size={14} color={colors.brand} />
                </Pressable>
              </View>
            </View>
          ))}

          {hasOnlyMains && upsells.length > 0 && (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellTitle}>PAIRS WELL WITH</Text>
              <Text style={styles.upsellHint}>Add a side or drink to complete the meal.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }} contentContainerStyle={{ gap: spacing.sm }}>
                {upsells.map((p) => (
                  <Pressable key={p.id} onPress={() => addUpsell(p)} style={styles.upsellItem} testID={`upsell-${p.id}`}>
                    <Image source={{ uri: p.image_url }} style={styles.upsellImg} />
                    <Text style={styles.upsellName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.upsellPrice}>{rupee(p.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {cart.length > 0 && (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLbl}>ROUND TOTAL</Text>
            <Text style={styles.totalVal}>{rupee(total)}</Text>
          </View>
          <Text style={styles.payHint}>Pay at counter · Bill settles at the end of your table session.</Text>
          {err && <Text style={styles.err}>{err}</Text>}
          <Pressable onPress={place} disabled={placing} style={styles.placeBtn} testID="place-order-btn">
            {placing ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.placeTxt}>SEND TO KITCHEN</Text>}
          </Pressable>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { padding: spacing.xs },
  title: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 20, letterSpacing: 0.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.onSurface },
  emptyHint: { fontFamily: font.body, color: colors.muted, textAlign: "center" },
  exploreBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.sm },
  exploreTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
  line: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, padding: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  vegRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vegDotOuter: { width: 12, height: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 5, height: 5, borderRadius: 2.5 },
  spiceTag: { fontFamily: font.body, fontSize: 10, color: colors.saffron, fontWeight: "800", letterSpacing: 1 },
  lineName: { fontFamily: font.display, fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  linePrice: { fontFamily: font.display, fontSize: 13, color: colors.brand, fontWeight: "800", marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  stepQty: { fontFamily: font.display, fontWeight: "800", fontSize: 15, color: colors.onSurface, minWidth: 20, textAlign: "center" },
  upsellCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  upsellTitle: { fontFamily: font.body, letterSpacing: 2, fontSize: 11, color: colors.brand, fontWeight: "800" },
  upsellHint: { fontFamily: font.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  upsellItem: { width: 110, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  upsellImg: { width: "100%", height: 60, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  upsellName: { fontFamily: font.body, fontSize: 12, fontWeight: "700", color: colors.onSurface, marginTop: spacing.xs },
  upsellPrice: { fontFamily: font.display, fontSize: 13, color: colors.brand, fontWeight: "800", marginTop: 2 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, ...shadow.strong },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLbl: { fontFamily: font.body, letterSpacing: 2, fontSize: 12, color: colors.muted, fontWeight: "700" },
  totalVal: { fontFamily: font.display, fontSize: 22, fontWeight: "800", color: colors.brand },
  payHint: { fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 4 },
  err: { color: colors.error, fontFamily: font.body, fontSize: 13, marginTop: 6 },
  placeBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.sm, alignItems: "center" },
  placeTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2, fontSize: 15 },
});
