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

  return (
    <CollectionProvider accountId={session.user.id}>
      <Stack />
    </CollectionProvider>
  );
}
