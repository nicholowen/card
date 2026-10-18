# One local Collection database per Account on the device

The mobile app keeps each Account's Collection in its own SQLite file (`collection-<accountId>.db`) rather than one shared file with an `account_id` column on every local table. The server keeps `account_id` on every row as ADR 0003 requires; the device scopes by file instead.

Phones get shared and handed over, and the app is offline-first (ADR 0006), so a second person may sign in on a device that still holds the first person's Unsynced Cards. A separate file means a query can't leak another Account's Card Copies through a missing `WHERE account_id = ?`, and signing out never has to delete data that hasn't reached the server yet.

## Considered Options

- One shared database with `account_id` on every local table: rejected because every local query would need the filter, and forgetting it shows one person's private Notes to another.
- Wiping the local database on sign-out: rejected because it would destroy Unsynced Cards.

## Consequences

- Local tables don't carry `account_id`; the sync layer adds it when pushing to the API.
- Deleting an Account on the device means deleting its database file.
- Cards scanned before signing up (spec story 40) need moving from an anonymous database into the new Account's file.
