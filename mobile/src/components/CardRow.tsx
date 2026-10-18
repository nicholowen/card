import { Link } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { cardDisplayName, type CardCopySummary } from "../collection";

/** One Card Copy in the Collection list; opens the card. */
export function CardRow({ card }: { card: CardCopySummary }) {
  const subtitle = [card.jobTitle, card.name ? card.company : undefined].filter(Boolean).join(" · ");
  return (
    <Link href={{ pathname: "/cards/[id]", params: { id: card.id } }} asChild>
      <Pressable style={styles.row}>
        <Text style={styles.title}>{cardDisplayName(card)}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, paddingVertical: 14, gap: 2 },
  title: { fontSize: 17, fontWeight: "600" },
  subtitle: { fontSize: 15, color: "#666" },
});
