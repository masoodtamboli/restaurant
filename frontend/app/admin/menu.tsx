import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow, rupee } from "@/src/theme";
import { request, store } from "@/src/api";
import AdminNav from "@/src/AdminNav";

export default function AdminMenu() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    const tok = await store.getAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    const p = await request<any[]>("/admin/products", { token: tok });
    setProducts(p);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (p: any, field: "is_available" | "is_popular") => {
    const tok = await store.getAdminToken();
    await request(`/admin/products/${p.id}`, { method: "PATCH", token: tok, body: { [field]: !p[field] } });
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const tok = await store.getAdminToken();
    const isNew = !editing.id;
    if (isNew) {
      await request("/admin/products", { method: "POST", token: tok, body: {
        name: editing.name, category: editing.category, description: editing.description || "",
        price: Number(editing.price), is_veg: !!editing.is_veg, is_popular: !!editing.is_popular,
        is_available: true, image_url: editing.image_url || "",
      }});
    } else {
      await request(`/admin/products/${editing.id}`, { method: "PATCH", token: tok, body: {
        name: editing.name, category: editing.category, description: editing.description || "",
        price: Number(editing.price), is_veg: !!editing.is_veg, is_popular: !!editing.is_popular,
        image_url: editing.image_url || "",
      }});
    }
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    const tok = await store.getAdminToken();
    await request(`/admin/products/${id}`, { method: "DELETE", token: tok });
    load();
  };

  const grouped = products.reduce((acc: Record<string, any[]>, p) => {
    acc[p.category] = acc[p.category] || [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]} testID="admin-menu-screen">
      <AdminNav title="Menu Management" />
      <View style={styles.addBar}>
        <Pressable
          onPress={() => setEditing({ name: "", category: "Tahari", price: 0, description: "", image_url: "", is_veg: false, is_popular: false })}
          style={styles.addBtn}
          testID="add-product-btn"
        >
          <Feather name="plus" size={16} color={colors.onBrand} />
          <Text style={styles.addTxt}>ADD ITEM</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <View key={cat} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.catTitle}>{cat.toUpperCase()}</Text>
              {items.map((p) => (
                <View key={p.id} style={styles.row} testID={`prod-${p.id}`}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <View style={[styles.vegDot, { borderColor: p.is_veg ? colors.success : colors.error }]}>
                        <View style={[styles.vegDotInner, { backgroundColor: p.is_veg ? colors.success : colors.error }]} />
                      </View>
                      <Text style={styles.nm} numberOfLines={1}>{p.name}</Text>
                      {p.is_popular && <View style={styles.popBadge}><Text style={styles.popTxt}>POP</Text></View>}
                    </View>
                    <Text style={styles.priceLine}>{rupee(p.price)}</Text>
                  </View>
                  <Pressable onPress={() => toggle(p, "is_popular")} style={[styles.togBtn, p.is_popular && { backgroundColor: colors.saffron, borderColor: colors.saffron }]} testID={`pop-${p.id}`}>
                    <Feather name="star" size={13} color={p.is_popular ? colors.onSaffron : colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => toggle(p, "is_available")} style={[styles.togBtn, p.is_available ? { backgroundColor: colors.success, borderColor: colors.success } : { backgroundColor: colors.error, borderColor: colors.error }]} testID={`avail-${p.id}`}>
                    <Feather name={p.is_available ? "check" : "x"} size={13} color={colors.onBrand} />
                  </Pressable>
                  <Pressable onPress={() => setEditing(p)} style={styles.togBtn} testID={`edit-${p.id}`}>
                    <Feather name="edit-2" size={13} color={colors.brand} />
                  </Pressable>
                  <Pressable onPress={() => del(p.id)} style={styles.togBtn} testID={`del-${p.id}`}>
                    <Feather name="trash-2" size={13} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{editing?.id ? "Edit Item" : "New Item"}</Text>
              <Pressable onPress={() => setEditing(null)} testID="close-edit"><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView>
              <TextInput placeholder="Name" value={editing?.name} onChangeText={(v) => setEditing({ ...editing, name: v })} style={styles.input} testID="edit-name" />
              <TextInput placeholder="Category" value={editing?.category} onChangeText={(v) => setEditing({ ...editing, category: v })} style={styles.input} testID="edit-category" />
              <TextInput placeholder="Price (₹)" value={String(editing?.price || "")} keyboardType="numeric" onChangeText={(v) => setEditing({ ...editing, price: v })} style={styles.input} testID="edit-price" />
              <TextInput placeholder="Description" value={editing?.description} multiline onChangeText={(v) => setEditing({ ...editing, description: v })} style={[styles.input, { height: 80 }]} testID="edit-desc" />
              <TextInput placeholder="Image URL" value={editing?.image_url} onChangeText={(v) => setEditing({ ...editing, image_url: v })} style={styles.input} testID="edit-image" />
              <View style={styles.togRow}>
                <Pressable style={[styles.checkBtn, editing?.is_veg && { backgroundColor: colors.success }]} onPress={() => setEditing({ ...editing, is_veg: !editing?.is_veg })} testID="edit-veg">
                  <Text style={[styles.checkTxt, editing?.is_veg && { color: colors.onBrand }]}>VEG</Text>
                </Pressable>
                <Pressable style={[styles.checkBtn, editing?.is_popular && { backgroundColor: colors.saffron }]} onPress={() => setEditing({ ...editing, is_popular: !editing?.is_popular })} testID="edit-popular">
                  <Text style={[styles.checkTxt, editing?.is_popular && { color: colors.onSaffron }]}>POPULAR</Text>
                </Pressable>
              </View>
              <Pressable onPress={saveEdit} style={styles.saveBtn} testID="save-edit"><Text style={styles.saveTxt}>SAVE</Text></Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  addBar: { padding: spacing.md, alignItems: "flex-end" },
  addBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm },
  addTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 1 },
  catTitle: { fontFamily: font.body, fontSize: 11, letterSpacing: 3, color: colors.brand, fontWeight: "800", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  vegDot: { width: 12, height: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegDotInner: { width: 5, height: 5, borderRadius: 2.5 },
  nm: { flex: 1, fontFamily: font.body, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  popBadge: { backgroundColor: colors.saffron, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  popTxt: { fontFamily: font.body, fontSize: 9, color: colors.onSaffron, fontWeight: "800", letterSpacing: 1 },
  priceLine: { fontFamily: font.display, fontSize: 13, color: colors.brand, fontWeight: "800", marginTop: 2 },
  togBtn: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontFamily: font.display, fontSize: 20, fontWeight: "800", color: colors.brand },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, fontFamily: font.body, fontSize: 14, marginBottom: 10, color: colors.onSurface },
  togRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  checkBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  checkTxt: { fontFamily: font.body, fontWeight: "800", color: colors.onSurface, letterSpacing: 1 },
  saveBtn: { backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.sm, alignItems: "center", marginTop: 4 },
  saveTxt: { color: colors.onBrand, fontFamily: font.display, fontWeight: "800", letterSpacing: 2 },
});
