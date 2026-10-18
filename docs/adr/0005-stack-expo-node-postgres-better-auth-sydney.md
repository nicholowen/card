# Expo app, Node API, Postgres, self-hosted Better Auth, hosted in Sydney

The mobile app is Expo / React Native and TypeScript, for iOS and Android at launch. The backend is a Node API on Postgres (`pg_trgm` for fuzzy search). Auth is Better Auth, self-hosted, offering Google, Apple and email OTP, with an SSO plugin available. Everything is hosted in Sydney (ap-southeast-2).

## Considered Options

- Supabase: rejected because identity would be tied to one Supabase project, which works against the plan for shared auth across several apps.
- Clerk / Auth0 / WorkOS: rejected because of per-user cost and because a third party would hold user identities, which conflicts with the product's privacy stance.
- Native Swift/Kotlin or Flutter: rejected because they would mean two codebases or a stack the developer is less fluent in.

## Consequences

- The same auth server is intended to become the identity provider for the developer's other apps.
- Hosting in Sydney means low latency for NZ/AU and gives a clear data-residency statement.
