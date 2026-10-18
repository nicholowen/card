import { router, Stack } from "expo-router";
import { ActivityIndicator } from "react-native";
import { CardForm } from "../../../components/CardForm";
import { useCollection } from "../../../lib/collection-context";

/** Enter a card by hand, for someone whose card you don't have (spec story 15). */
export default function NewCardScreen() {
  const collection = useCollection();

  return (
    <>
      <Stack.Screen options={{ title: "New card" }} />
      {collection ? (
        <CardForm
          submitTitle="Save card"
          onSubmit={async (fields) => {
            const card = await collection.addManual(fields);
            router.replace({ pathname: "/cards/[id]", params: { id: card.id } });
          }}
        />
      ) : (
        <ActivityIndicator style={{ flex: 1 }} />
      )}
    </>
  );
}
