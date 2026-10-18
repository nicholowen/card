import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CARD_TEXT_FIELDS, cardDisplayName } from "../../../../collection";
import { Button } from "../../../../components/Button";
import { CardDeleted } from "../../../../components/CardDeleted";
import { CARD_FIELD_LABELS } from "../../../../components/card-field-labels";
import { useCardCopy } from "../../../../lib/use-card-copy";
import { useCollection } from "../../../../lib/collection-context";

/** Every field except the name, which is the card's heading. */
const DETAIL_FIELDS = CARD_TEXT_FIELDS.filter((key) => key !== "name");

/** One Card Copy: My Version, with edit and delete. */
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection();
  const card = useCardCopy(id);
  const [deleting, setDeleting] = useState(false);

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
      <>
        <Stack.Screen options={{ title: "Card" }} />
        <CardDeleted />
      </>
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
      <Text style={styles.name}>{cardDisplayName(fields)}</Text>

      {DETAIL_FIELDS.filter((key) => fields[key]).map((key) => (
        <View key={key} style={styles.detail}>
          <Text style={styles.label}>{CARD_FIELD_LABELS[key]}</Text>
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
  headerAction: { fontSize: 16, color: "#0a66c2" },
  name: { fontSize: 26, fontWeight: "700" },
  detail: { gap: 2 },
  label: { fontSize: 13, fontWeight: "600", color: "#666", textTransform: "uppercase" },
  value: { fontSize: 17 },
  actions: { marginTop: 16 },
});
