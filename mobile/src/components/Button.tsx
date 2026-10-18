import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

export function Button({
  title,
  onPress,
  busy,
  disabled = false,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) {
  const outline = variant === "outline";
  return (
    <Pressable
      style={[styles.button, outline && styles.outline, (busy || disabled) && styles.busy]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? (
        <ActivityIndicator color={outline ? "#111" : "#fff"} />
      ) : (
        <Text style={[styles.text, outline && styles.outlineText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: "#111", borderRadius: 10, padding: 15, alignItems: "center" },
  outline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#111" },
  busy: { opacity: 0.6 },
  text: { color: "#fff", fontSize: 17, fontWeight: "600" },
  outlineText: { color: "#111" },
});
