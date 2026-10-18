import { Link, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { CardCopySummary } from "../../collection";
import { authClient } from "../../lib/auth-client";
import { useCollection } from "../../lib/collection-context";

export default function CollectionScreen() {
  const collection = useCollection();
  const { data: session } = authClient.useSession();
  const [cards, setCards] = useState<CardCopySummary[] | null>(null);

  // Reload whenever the screen comes back into view, e.g. after adding or deleting a card.
  useFocusEffect(
    useCallback(() => {
      collection?.list().then(setCards);
    }, [collection]),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Collection",
          headerLeft: () =>
            session ? (
              <Pressable onPress={() => authClient.signOut()} hitSlop={8}>
                <Text style={styles.headerAction}>Sign out</Text>
              </Pressable>
            ) : (
              <Link href="/sign-in" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.headerAction}>Sign in</Text>
                </Pressable>
              </Link>
            ),
          headerRight: () => (
            <Link href="/cards/new" asChild>
              <Pressable hitSlop={8} accessibilityLabel="Add a card by hand">
                <Text style={styles.headerAction}>Add</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      {cards === null ? (
        <ActivityIndicator style={styles.centre} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(card) => card.id}
          renderItem={({ item }) => <CardRow card={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={cards.length === 0 ? styles.centre : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cards yet</Text>
              <Text style={styles.emptyBody}>Cards you add will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function CardRow({ card }: { card: CardCopySummary }) {
  const title = card.name ?? card.company ?? "Unnamed card";
  const subtitle = [card.jobTitle, card.name ? card.company : undefined].filter(Boolean).join(" · ");
  return (
    <Link href={{ pathname: "/cards/[id]", params: { id: card.id } }} asChild>
      <Pressable style={styles.row}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  centre: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 6, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyBody: { fontSize: 15, color: "#666" },
  headerAction: { fontSize: 16, color: "#0a66c2" },
  row: { paddingHorizontal: 20, paddingVertical: 14, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  rowSubtitle: { fontSize: 15, color: "#666" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#ddd", marginLeft: 20 },
});
