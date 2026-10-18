import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { CardCopy } from "../../../../collection";
import { CardForm } from "../../../../components/CardForm";
import { useCollection } from "../../../../lib/collection-context";

/** Edit My Version: the Holder's own copy of the card (ADR 0001). */
export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection();
  const [card, setCard] = useState<CardCopy | null | undefined>(undefined);

  useEffect(() => {
    collection?.get(id).then(setCard);
  }, [collection, id]);

  return (
    <>
      <Stack.Screen options={{ title: "Edit card" }} />
      {card === undefined || !collection ? (
        <ActivityIndicator style={styles.centre} />
      ) : card === null ? (
        <View style={styles.centre}>
          <Text style={styles.missing}>This card has been deleted.</Text>
        </View>
      ) : (
        <CardForm
          initial={card.fields}
          submitTitle="Save changes"
          onSubmit={async (fields) => {
            await collection.editMyVersion(card.id, fields);
            router.back();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  missing: { fontSize: 16, color: "#666" },
});
