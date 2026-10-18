import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Collection, ScanReview } from "../../../collection";
import { captureCardFront, ScannerUnavailable } from "../../../collection/adapters/card-scanner";
import { Button } from "../../../components/Button";
import { CardForm } from "../../../components/CardForm";
import { CardPhoto } from "../../../components/CardPhoto";
import { useCollection } from "../../../lib/collection-context";

type ScanState =
  | { step: "capturing" }
  | { step: "reading" }
  | { step: "reviewing"; review: ScanReview }
  | { step: "unavailable" }
  | { step: "failed" };

/**
 * Scan the front of a card: the camera captures it on its own, the text is
 * read and parsed on this phone, and the Holder checks the fields before
 * saving (spec stories 1–5, 9, 13, 14). Works signed out and offline.
 */
export default function ScanCardScreen() {
  const collection = useCollection();
  const [state, setState] = useState<ScanState>({ step: "capturing" });
  const started = useRef(false);

  async function scan(collection: Collection) {
    setState({ step: "capturing" });
    try {
      const front = await captureCardFront();
      if (!front) {
        router.back();
        return;
      }
      setState({ step: "reading" });
      setState({ step: "reviewing", review: await collection.scan(front) });
    } catch (error) {
      setState({ step: error instanceof ScannerUnavailable ? "unavailable" : "failed" });
    }
  }

  // Open the camera as soon as the Collection is ready, once.
  useEffect(() => {
    if (!collection || started.current) return;
    started.current = true;
    void scan(collection);
  }, [collection]);

  return (
    <>
      <Stack.Screen options={{ title: state.step === "reviewing" ? "Check the details" : "Scan a card" }} />
      {state.step === "reviewing" && collection ? (
        <CardForm
          initial={state.review.fields}
          flagged={state.review.needsChecking}
          header={
            <View style={styles.header}>
              <CardPhoto image={state.review.front} />
              <Text style={styles.note}>
                {Object.keys(state.review.fields).length === 0
                  ? "No text could be read from this card. Type in the details, or scan it again."
                  : "Read on this phone, so some details may be wrong. Fix anything that doesn't match the card."}
              </Text>
            </View>
          }
          submitTitle="Save card"
          onSubmit={async (fields) => {
            const card = await collection.saveScan(state.review, fields);
            router.replace({ pathname: "/cards/[id]", params: { id: card.id } });
          }}
        />
      ) : state.step === "unavailable" ? (
        <Message
          title="Scanning isn't available on this device"
          body="You can still add the card by typing in its details."
          action={<Button title="Add by hand" onPress={() => router.replace("/cards/new")} busy={false} />}
        />
      ) : state.step === "failed" ? (
        <Message
          title="Couldn't scan that card"
          body="Something went wrong reading the card. Try again with the card flat and well lit."
          action={collection ? <Button title="Scan again" onPress={() => scan(collection)} busy={false} /> : null}
        />
      ) : (
        <View style={styles.centre}>
          <ActivityIndicator />
          {state.step === "reading" ? <Text style={styles.note}>Reading the card…</Text> : null}
        </View>
      )}
    </>
  );
}

function Message({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <View style={[styles.centre, styles.message]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff" },
  message: { padding: 24 },
  header: { gap: 10, marginBottom: 6 },
  note: { fontSize: 14, color: "#666" },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 15, color: "#666", textAlign: "center" },
  action: { alignSelf: "stretch", marginTop: 8 },
});
