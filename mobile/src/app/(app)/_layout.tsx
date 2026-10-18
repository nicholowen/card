import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authClient } from "../../lib/auth-client";
import { CollectionProvider } from "../../lib/collection-context";

/** Everything inside (app) needs a signed-in Account. */
export default function SignedInLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  // Better Auth calls the Account a "user"; the app only ever says Account.
  const accountId = session.user.id;

  return (
    <CollectionProvider accountId={accountId}>
      <Stack />
    </CollectionProvider>
  );
}
