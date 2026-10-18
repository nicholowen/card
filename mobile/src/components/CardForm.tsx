import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import {
  CARD_TEXT_FIELDS,
  CardHasNoDetails,
  type CardFields,
  type CardTextField,
  type SocialHandle,
} from "../collection";
import { Button } from "./Button";
import { CARD_FIELD_LABELS } from "./card-field-labels";

/** Keyboard and autofill hints for each field. */
const INPUT_PROPS: Record<CardTextField, TextInputProps> = {
  name: { autoCapitalize: "words", textContentType: "name" },
  jobTitle: { autoCapitalize: "words", textContentType: "jobTitle" },
  company: { autoCapitalize: "words", textContentType: "organizationName" },
  email: { autoCapitalize: "none", keyboardType: "email-address", textContentType: "emailAddress" },
  phone: { keyboardType: "phone-pad", textContentType: "telephoneNumber" },
  website: { autoCapitalize: "none", keyboardType: "url", textContentType: "URL" },
  address: { multiline: true, textContentType: "fullStreetAddress" },
};

/** The fields of a card as the Holder types them. Blank values are fine; the Collection drops them. */
export function CardForm({
  initial = {},
  submitTitle,
  onSubmit,
}: {
  initial?: CardFields;
  submitTitle: string;
  onSubmit: (fields: CardFields) => Promise<void>;
}) {
  const [fields, setFields] = useState<CardFields>(initial);
  const [socials, setSocials] = useState<SocialHandle[]>(initial.socials ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSocial(index: number, change: Partial<SocialHandle>) {
    setSocials((current) => current.map((social, i) => (i === index ? { ...social, ...change } : social)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...fields, socials });
    } catch (e) {
      setError(e instanceof CardHasNoDetails ? "Add at least one detail, such as a name." : "Couldn't save this card.");
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {CARD_TEXT_FIELDS.map((key) => {
          const input = INPUT_PROPS[key];
          return (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{CARD_FIELD_LABELS[key]}</Text>
              <TextInput
                style={[styles.input, input.multiline && styles.multiline]}
                value={fields[key] ?? ""}
                onChangeText={(value) => setFields((current) => ({ ...current, [key]: value }))}
                autoCorrect={false}
                editable={!busy}
                {...input}
              />
            </View>
          );
        })}

        <Text style={styles.label}>Social</Text>
        {socials.map((social, index) => (
          <View key={index} style={styles.socialRow}>
            <TextInput
              style={[styles.input, styles.network]}
              value={social.network}
              onChangeText={(network) => setSocial(index, { network })}
              placeholder="LinkedIn"
              autoCorrect={false}
              editable={!busy}
            />
            <TextInput
              style={[styles.input, styles.flex]}
              value={social.handle}
              onChangeText={(handle) => setSocial(index, { handle })}
              placeholder="Handle or link"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Pressable
              onPress={() => setSocials((current) => current.filter((_, i) => i !== index))}
              hitSlop={8}
              accessibilityLabel="Remove social handle"
            >
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setSocials((current) => [...current, { network: "", handle: "" }])} disabled={busy}>
          <Text style={styles.link}>Add a social handle</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={submitTitle} onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 20, gap: 14, backgroundColor: "#fff" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, fontSize: 17 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  network: { width: 110 },
  remove: { fontSize: 18, color: "#666", paddingHorizontal: 4 },
  link: { color: "#0a66c2", fontSize: 15, paddingVertical: 4 },
  error: { color: "#b3261e", fontSize: 15 },
});
