import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { authClient } from "./auth-client";

export type SocialProvider = "google" | "apple";

export type SocialSignInResult = { kind: "signed-in" } | { kind: "cancelled" } | { kind: "failed"; message: string };

const PROVIDER_NAMES: Record<SocialProvider, string> = { google: "Google", apple: "Apple" };

/**
 * On iPhone, Sign in with Apple uses the system sheet and sends Apple's ID token
 * to the API. Android has no system sheet for Apple, so it uses the browser.
 */
export async function hasNativeAppleSignIn(): Promise<boolean> {
  return Platform.OS === "ios" && (await AppleAuthentication.isAvailableAsync());
}

export async function signInWith(provider: SocialProvider): Promise<SocialSignInResult> {
  if (provider === "apple" && (await hasNativeAppleSignIn())) return signInWithNativeApple();
  return signInInBrowser(provider);
}

async function signInWithNativeApple(): Promise<SocialSignInResult> {
  // The API checks that Apple's token carries this nonce, so a captured token can't be replayed.
  const nonce = Crypto.randomUUID();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return { kind: "cancelled" };
    return failure("apple");
  }
  if (!credential.identityToken) return failure("apple");

  // Apple shares the name only on the first sign-in, and only with the app.
  const { givenName, familyName } = credential.fullName ?? {};
  const name =
    givenName || familyName ? { firstName: givenName ?? undefined, lastName: familyName ?? undefined } : undefined;

  const { error } = await authClient.signIn.social({
    provider: "apple",
    idToken: { token: credential.identityToken, nonce, ...(name && { user: { name } }) },
  });
  return error ? failureFromResponse("apple", error) : { kind: "signed-in" };
}

/**
 * Better Auth's Expo plugin opens the provider in an in-app browser and stores
 * the session when the browser hands back to the app.
 */
async function signInInBrowser(provider: SocialProvider): Promise<SocialSignInResult> {
  const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
  if (error) return failureFromResponse(provider, error);

  // The browser closes the same way whether the person finished or backed out,
  // so whether a session now exists is what tells them apart.
  const { data: session } = await authClient.getSession();
  return session ? { kind: "signed-in" } : { kind: "cancelled" };
}

/** 404 means the server isn't configured for this provider. */
function failureFromResponse(provider: SocialProvider, error: { status: number }): SocialSignInResult {
  if (error.status === 404) {
    return { kind: "failed", message: `Signing in with ${PROVIDER_NAMES[provider]} isn't available yet. Use your email instead.` };
  }
  return failure(provider);
}

function failure(provider: SocialProvider): SocialSignInResult {
  return {
    kind: "failed",
    message: `Couldn't sign in with ${PROVIDER_NAMES[provider]}. Try again, or sign in with your email.`,
  };
}
