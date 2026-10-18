import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";
import { CardDeleted } from "../../../../components/CardDeleted";
import { CardForm } from "../../../../components/CardForm";
import { useCardCopy } from "../../../../lib/use-card-copy";
import { useCollection } from "../../../../lib/collection-context";

/** Edit My Version: the Holder's own copy of the card (ADR 0001). */
export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection();
  const card = useCardCopy(id);

  return (
    <>
      <Stack.Screen options={{ title: "Edit card" }} />
      {card === undefined || !collection ? (
        <ActivityIndicator style={styles.centre} />
      ) : card === null ? (
        <CardDeleted />
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
});
