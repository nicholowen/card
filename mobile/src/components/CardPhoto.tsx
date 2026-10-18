import { Image, StyleSheet } from "react-native";
import type { CardImage } from "../collection";

/** The photo of a scanned card, at a business card's proportions. */
export function CardPhoto({ image }: { image: CardImage }) {
  return (
    <Image
      source={{ uri: image.uri }}
      style={styles.photo}
      resizeMode="contain"
      accessibilityLabel="Photo of the card"
    />
  );
}

const styles = StyleSheet.create({
  // Most business cards are about 85 × 55 mm.
  photo: { width: "100%", aspectRatio: 85 / 55, borderRadius: 10, backgroundColor: "#f2f2f2" },
});
