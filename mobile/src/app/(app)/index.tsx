import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { CardCopySummary } from "../../collection";
import { authClient } from "../../lib/auth-client";
import { useCollection } from "../../lib/collection-context";

export default function CollectionScreen() {
  const collection = useCollection();
  const [cards, setCards] = useState<CardCopySummary[] | null>(null);

  useEffect(() => {
    collection?.list().then(setCards);
  }, [collection]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Collection",
          headerRight: () => (
            <Pressable onPress={() => authClient.signOut()} hitSlop={8}>
              <Text style={styles.headerAction}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
      {cards === null ? (
        <ActivityIndicator style={styles.centre} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(card) => card.id}
          renderItem={({ item }) => <Text>{item.id}</Text>}
          contentContainerStyle={cards.length === 0 ? styles.centre : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cards yet</Text>
              <Text style={styles.emptyBody}>Cards you scan will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  centre: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 6, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyBody: { fontSize: 15, color: "#666" },
  headerAction: { fontSize: 16, color: "#0a66c2" },
});
