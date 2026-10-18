import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CardCopy, CardFields } from "../../../../collection";
import { Button } from "../../../../components/Button";
import { useCollection } from "../../../../lib/collection-context";

const DETAIL_ROWS: { key: Exclude<keyof CardFields, "socials" | "name">; label: string }[] = [
  { key: "jobTitle", label: "Job title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
];

/** One Card Copy: My Version, with edit and delete. */
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection();
  const [card, setCard] = useState<CardCopy | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  // Reload on focus so returning from the edit screen shows the change.
  useFocusEffect(
    useCallback(() => {
      collection?.get(id).then(setCard);
    }, [collection, id]),
  );

  function confirmDelete() {
    if (!collection || !card) return;
    Alert.alert("Delete this card?", "It will be removed from your Collection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          await collection.delete(card.id);
          router.back();
        },
      },
    ]);
  }

  if (card === undefined) return <ActivityIndicator style={styles.centre} />;

  if (card === null) {
    return (
      <View style={styles.centre}>
        <Stack.Screen options={{ title: "Card" }} />
        <Text style={styles.empty}>This card has been deleted.</Text>
      </View>
    );
  }

  const { fields } = card;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Link href={{ pathname: "/cards/[id]/edit", params: { id: card.id } }} asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.headerAction}>Edit</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <Text style={styles.name}>{fields.name ?? fields.company ?? "Unnamed card"}</Text>

      {DETAIL_ROWS.filter(({ key }) => fields[key]).map(({ key, label }) => (
        <View key={key} style={styles.detail}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} selectable>
            {fields[key]}
          </Text>
        </View>
      ))}

      {fields.socials?.map((social, index) => (
        <View key={index} style={styles.detail}>
          <Text style={styles.label}>{social.network || "Social"}</Text>
          <Text style={styles.value} selectable>
            {social.handle}
          </Text>
        </View>
      ))}

      <View style={styles.actions}>
        <Button title="Delete card" variant="outline" onPress={confirmDelete} busy={deleting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, gap: 16 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  empty: { fontSize: 16, color: "#666" },
  headerAction: { fontSize: 16, color: "#0a66c2" },
  name: { fontSize: 26, fontWeight: "700" },
  detail: { gap: 2 },
  label: { fontSize: 13, fontWeight: "600", color: "#666", textTransform: "uppercase" },
  value: { fontSize: 17 },
  actions: { marginTop: 16 },
});
