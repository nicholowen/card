import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authClient } from "../../lib/auth-client";
import { CollectionProvider } from "../../lib/collection-context";

/**
 * The Collection works with or without an Account (spec story 13). Signed in,
 * it's the Account's own Collection; signed out, it's the device's anonymous
 * one. A session cached on the device keeps the Account's Collection open offline.
 */
export default function CollectionLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Better Auth calls the Account a "user"; the app only ever says Account.
  const accountId = session?.user.id ?? null;

  return (
    <CollectionProvider accountId={accountId}>
      <Stack />
    </CollectionProvider>
  );
}
