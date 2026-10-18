import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

export function Button({ title, onPress, busy }: { title: string; onPress: () => void; busy: boolean }) {
  return (
    <Pressable style={[styles.button, busy && styles.busy]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: "#111", borderRadius: 10, padding: 15, alignItems: "center" },
  busy: { opacity: 0.6 },
  text: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
