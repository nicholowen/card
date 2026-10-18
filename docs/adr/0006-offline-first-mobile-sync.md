# Offline-first mobile app with last-write-wins sync

The app keeps the Collection in a local SQLite database and syncs with the API in the background, resolving conflicts by last write wins per record. Scanning, Notes, Tags and search all work with no connection. Unsynced Cards are surfaced to the user, with a prompt to sync once there is coverage.

Venue connectivity is unreliable, and the app's core moment happens at events. Last-write-wins is safe because only one Account ever writes to a given Card Copy.

## Consequences

- Fuzzy search runs on the device against the local database.
- Owner changes to Core Cards reach Holders on their next sync, not instantly.
