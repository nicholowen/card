import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Collection, ScanReview } from "../../../collection";
import { captureCardFront, ScannerNotReady, ScannerUnavailable } from "../../../collection/adapters/card-scanner";
import { Button } from "../../../components/Button";
import { CardForm } from "../../../components/CardForm";
import { CardPhoto } from "../../../components/CardPhoto";
import { useCollection } from "../../../lib/collection-context";

type ScanState =
  | { step: "capturing" }
  | { step: "reading" }
  | { step: "reviewing"; review: ScanReview }
  | { step: "unavailable"; detail: string }
  | { step: "notReady"; detail: string }
  | { step: "failed"; detail: string };

/**
 * Scan the front of a card: the camera captures it on its own, the text is
 * read on this phone and parsed in the cloud when signed in with signal (on
 * the phone otherwise), and the Holder checks the fields before saving, with
 * low-confidence ones marked (spec stories 1–5, 9, 13, 14). Works signed out
 * and offline.
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
      if (error instanceof ScannerUnavailable) setState({ step: "unavailable", detail: error.detail });
      else if (error instanceof ScannerNotReady) setState({ step: "notReady", detail: error.detail });
      else {
        console.error("[scan] Scanning the card failed", error);
        setState({ step: "failed", detail: error instanceof Error ? error.message : String(error) });
      }
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
              <Text style={styles.note}>{reviewNote(state.review)}</Text>
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
          detail={state.detail}
          action={<Button title="Add by hand" onPress={() => router.replace("/cards/new")} busy={false} />}
        />
      ) : state.step === "notReady" ? (
        <Message
          title="The scanner isn't ready yet"
          body="The first time you scan, your phone may need an internet connection to finish setting up the scanner. Try again once you're connected, or add the card by hand."
          detail={state.detail}
          action={
            <View style={styles.actions}>
              {collection ? <Button title="Try again" onPress={() => scan(collection)} busy={false} /> : null}
              <Button title="Add by hand" variant="outline" onPress={() => router.replace("/cards/new")} busy={false} />
            </View>
          }
        />
      ) : state.step === "failed" ? (
        <Message
          title="Couldn't scan that card"
          body="Something went wrong reading the card. Try again with the card flat and well lit."
          detail={state.detail}
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

/** What the review screen tells the Holder about how the card was read. */
function reviewNote(review: ScanReview): string {
  if (Object.keys(review.fields).length === 0) {
    return "No text could be read from this card. Type in the details, or scan it again.";
  }
  const check = review.needsChecking.length > 0 ? " Check the marked fields against the card." : "";
  if (review.parsedBy === "device") {
    return `Parsed on this phone only, so some details may be less accurate.${check} Fix anything that doesn't match the card.`;
  }
  return review.needsChecking.length > 0
    ? "Check the marked fields against the card, and fix anything that doesn't match."
    : "Fix anything that doesn't match the card.";
}

/** A full-screen message. In development it also shows the underlying error, to save a trip to the logs. */
function Message({ title, body, detail, action }: { title: string; body: string; detail: string; action: ReactNode }) {
  return (
    <View style={[styles.centre, styles.message]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {__DEV__ ? (
        <Text style={styles.detail} selectable>
          {detail}
        </Text>
      ) : null}
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
  detail: { fontSize: 12, color: "#999", textAlign: "center", fontFamily: "monospace" },
  action: { alignSelf: "stretch", marginTop: 8 },
  actions: { gap: 10 },
});
