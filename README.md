# Card

A networking app for professionals who exchange business cards at events. People scan the cards they receive into a private Collection, and anyone can own a verified Core Card so that everyone holding their card sees their current details.

## Docs

- [`CONTEXT.md`](./CONTEXT.md): the domain glossary. Use these terms in code, issues and PRs.
- [`docs/adr/`](./docs/adr/): architecture decision records.
- [`docs/spec-v1.md`](./docs/spec-v1.md): the v1 spec.

## Layout

An npm workspace with two deployables (ADR 0005):

- [`api/`](./api): Node + TypeScript API on Postgres, using Hono and self-hosted Better Auth.
- [`mobile/`](./mobile): Expo / React Native + TypeScript app for iOS and Android, using Expo Router.

## Prerequisites

- Node 22.13 or later (the mobile tests use the built-in `node:sqlite`)
- Postgres 16, either via Docker (`docker compose up -d`) or installed locally
- For running the app on a device or simulator: Xcode (iOS) and/or Android Studio (Android)

Install everything from the repo root:

```sh
npm install
```

## Running the API

```sh
docker compose up -d          # Postgres on localhost:5432 with card_dev and card_test databases
cp api/.env.example api/.env  # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run migrate -w api        # create the auth tables
npm run dev -w api            # http://localhost:3000
```

The `card_test` database is created by an init script that only runs the first time the Docker volume is created. If you already had the volume, create it by hand: `psql -h localhost -U postgres -c 'CREATE DATABASE card_test'`.

There is no real email sender yet. Sign-in codes are printed to the API's console:

```
[email] sign-in code for you@example.com: 123456
```

### Google and Apple sign-in

Email codes work with no extra setup. Google and Apple are each offered only once their settings in `api/.env` are filled in (see the comments in `api/.env.example`); until then the app's buttons say they aren't available yet.

How each one signs in:

- **Apple on iPhone** uses the system sheet (`expo-apple-authentication`). The app sends Apple's ID token to the API, which checks it against `APPLE_APP_BUNDLE_IDENTIFIER`. This also works in Expo Go in development.
- **Google (both platforms) and Apple on Android** open the provider in an in-app browser. The provider sends the browser back to the API at `<BETTER_AUTH_URL>/api/auth/callback/<google|apple>`, which hands the session to the app through its `card://` link. Register exactly that URL with the provider.

Because the browser flow returns to `BETTER_AUTH_URL`, that address must be one the provider accepts: Google allows `http://localhost` but not LAN addresses, and Apple only allows `https`. To test these on a phone, expose the API through an HTTPS tunnel and use the tunnel's address for both `BETTER_AUTH_URL` and `EXPO_PUBLIC_API_URL`.

Signing in with Google or Apple uses the same Account as email codes when the provider has verified that email address. If an Account with that email exists but the provider hasn't verified the address, the sign-in is refused rather than joined to it. Apple's "Hide My Email" addresses get their own Account.

`APPLE_CLIENT_SECRET` is a JWT that expires after at most six months. Generate a new one before then, or Apple sign-in on Android stops working.

Accounts have a `role` of `member` (the default) or `admin`. There's no admin UI; promote an Account in SQL:

```sql
UPDATE account SET role = 'admin' WHERE email = 'you@example.com';
```

Better Auth's tables are renamed to match the glossary: `account` is our Account (Better Auth calls it "user"), `auth_credential` holds sign-in methods, and `auth_session` / `auth_verification` hold sessions and one-time codes.

## Running the app

The app is meant to run as a **development build**. Expo Go works for now, because everything the app uses so far ships inside Expo Go, but it will stop working once on-device OCR lands.

The API only accepts sign-in requests from origins it trusts. The app's own `card://` scheme is always trusted. Expo Go sends `exp://…` instead, which is trusted unless `NODE_ENV=production`. If sign-in fails with "Invalid origin", the API console logs the origin it rejected.

```sh
cp mobile/.env.example mobile/.env   # set EXPO_PUBLIC_API_URL (see below)
npm run ios -w mobile                # builds and installs the dev build in the iOS simulator
npm run android -w mobile            # builds and installs it on an Android emulator or device
```

After the first native build, `npm start -w mobile` starts Metro for JavaScript-only changes. Rebuild with `ios`/`android` whenever a native dependency or `app.json` changes.

`EXPO_PUBLIC_API_URL` must be reachable from the phone:

- iOS simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`
- Physical device: your computer's LAN address, e.g. `http://192.168.1.20:3000`, and set `BETTER_AUTH_URL` in `api/.env` to the same address

Sign in with any email address, copy the code from the API console, and you land on an empty Collection.

## Tests

Two test seams, described in the spec's Testing Decisions. Run both from the root with `npm test`, or one at a time:

```sh
npm test -w api      # the API over HTTP, against real Postgres (needs the card_test database)
npm test -w mobile   # the Collection module, against in-memory SQLite
npm run typecheck    # both workspaces
```

**API (`api/test/`)**: each test calls `startTestApi()`, which creates a fresh Postgres schema in `card_test`, runs migrations into it, and starts the API on a random port with in-process fakes for email, the LLM provider and object storage. Tests talk to it with `TestClient` (keeps cookies like a phone would) and read emailed codes from `api.email`. The schema is dropped in `close()`. Point at another database with `TEST_DATABASE_URL`.

**Collection (`mobile/test/`)**: `createTestCollection()` opens the Collection against an in-memory SQLite database with fake OCR, a fake on-device parser and a fake API client. Tests only use the `Collection` interface, never the database directly. This suite doesn't load React Native, so it runs in plain Node.

UI screens, the real camera and on-device models aren't covered by automated tests; they're tested by hand on devices.
