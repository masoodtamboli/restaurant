import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState("Medium");

  useEffect(() => {
    if (!id) return;
    request(`/menu/${id}`).then((p: any) => {
      setItem(p);
      if (p.spice_level_options?.length) setSpice(p.spice_level_options[1] || p.spice_level_options[0]);
    });
  }, [id]);

  const add = async () => {
    if (!item) return;
    const cart = await store.getCart();
    cart.push({ product_id: item.id, name: item.name, qty, price: item.price, image_url: item.image_url, is_veg: item.is_veg, spice_level: spice });
    await store.setCart(cart);
    router.back();
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.wrap}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.wrap} testID="item-detail-screen">
      <View style={styles.heroWrap}>
        <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
        <View style={styles.scrim} />
        <SafeAreaView edges={["top"]}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="item-back">
            <Feather name="arrow-left" size={22} color={colors.onBrand} />
          </Pressable>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        <View style={styles.vegRow}>
          <View style={[styles.vegDotOuter, { borderColor: item.is_veg ? colors.success : colors.error }]}>
            <View style={[styles.vegDot, { backgroundColor: item.is_veg ? colors.success : colors.error }]} />
          </View>
          <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.desc}>{item.description}</Text>

        <Text style={styles.section}>SPICE LEVEL</Text>
        <View style={styles.spiceRow}>
          {(item.spice_level_options || []).map((s: string) => {
            const active = s === spice;
            return (
              <Pressable
                key={s}
                onPress={() => setSpice(s)}
                style={[styles.spice, active && styles.spiceActive]}
                testID={`spice-${s}`}
              >
                <Text style={[styles.spiceTxt, active && styles.spiceTxtActive]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>QUANTITY</Text>
        <View style={styles.qtyRow}>
          <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn} testID="qty-minus">
            <Feather name="minus" size={18} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.qtyNum}>{qty}</Text>
          <Pressable onPress={() => setQty(qty + 1)} style={styles.qtyBtn} testID="qty-plus">
            <Feather name="plus" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Pressable onPress={add} style={styles.addBtn} testID="add-to-cart-btn">
          <Text style={styles.addTxt}>ADD {qty} · {rupee(item.price * qty)}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: 300, position: "relative" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(43,24,16,0.35)" },
  back: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(43,24,16,0.55)", alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, marginTop: -24, backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  vegRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vegDotOuter: { width: 14, height: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  category: { fontFamily: font.body, letterSpacing: 2, fontSize: 11, color: colors.saffron, fontWeight: "800" },
  name: { fontFamily: font.display, fontSize: 30, fontWeight: "800", color: colors.brand, marginTop: spacing.sm },
  desc: { fontFamily: font.body, fontSize: 14, color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  section: { fontFamily: font.body, letterSpacing: 2, fontSize: 11, color: colors.muted, marginTop: spacing.xl, fontWeight: "800" },
  spiceRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  spice: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  spiceActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  spiceTxt: { fontFamily: font.body, fontWeight: "700", color: colors.onSurface },
  spiceTxtActive: { color: colors.onBrand },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl, marginTop: spacing.md },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  qtyNum: { fontFamily: font.display, fontSize: 24, fontWeight: "800", color: colors.onSurface, minWidth: 40, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, ...shadow.strong },
  addBtn: { backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.sm, alignItems: "center" },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", fontSize: 15, letterSpacing: 2 },
});
