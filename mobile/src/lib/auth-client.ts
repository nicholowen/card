import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env.");
}

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    expoClient({ scheme: "card", storagePrefix: "card", storage: SecureStore }),
    emailOTPClient(),
  ],
});
