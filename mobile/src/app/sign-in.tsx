import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { authClient } from "../lib/auth-client";

type Step = { kind: "email" } | { kind: "code"; email: string };

export default function SignInScreen() {
  const { data: session } = authClient.useSession();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
    setBusy(false);
    if (error) setError(error.message ?? "Couldn't send a code. Check your connection and try again.");
    else setStep({ kind: "code", email: address });
  }

  async function verifyCode() {
    if (step.kind !== "code" || code.length === 0) return;
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: step.email, otp: code.trim() });
    setBusy(false);
    if (error) setError("That code didn't work. Check it and try again, or send a new one.");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.form}>
        <Text style={styles.title}>Card</Text>

        {step.kind === "email" ? (
          <>
            <Text style={styles.label}>Sign in with your email. We'll send you a code.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              editable={!busy}
            />
            <Button title="Send code" onPress={sendCode} busy={busy} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the code we emailed to {step.email}.</Text>
            <TextInput
              style={[styles.input, styles.code]}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={verifyCode}
              editable={!busy}
              autoFocus
            />
            <Button title="Sign in" onPress={verifyCode} busy={busy} />
            <Pressable
              onPress={() => {
                setCode("");
                setError(null);
                setStep({ kind: "email" });
              }}
            >
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  form: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 16, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 14, fontSize: 17 },
  code: { letterSpacing: 6, fontSize: 22 },
  link: { color: "#0a66c2", fontSize: 15, textAlign: "center", padding: 8 },
  error: { color: "#b3261e", fontSize: 15 },
});
