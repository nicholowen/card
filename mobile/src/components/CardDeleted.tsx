import { StyleSheet, Text, View } from "react-native";

/** Shown when a card screen is opened for a Card Copy that has been deleted. */
export function CardDeleted() {
  return (
    <View style={styles.centre}>
      <Text style={styles.text}>This card has been deleted.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  text: { fontSize: 16, color: "#666" },
});
