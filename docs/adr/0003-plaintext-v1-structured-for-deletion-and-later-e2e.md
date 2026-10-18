# Plaintext storage in v1, structured for deletion and later E2E encryption

v1 stores Card Copies in plaintext so the sole developer can debug and support users. The data model is shaped so a single Account can be deleted cheaply, and so end-to-end encryption can be added later without redesigning anything:

- Every row belongs to exactly one Account, directly or by cascade, and storage paths are prefixed with the Account ID.
- `card_link` (Card Copy → Core Card) is the only table that references across Accounts.
- A Card Copy's personal fields live in one JSON payload column, so encrypting them later is a change to one column.
- Identifiers are stored hashed alongside the plaintext from day one, so matching still works unchanged once the plaintext is removed.

## Considered Options

- E2E from launch: rejected for v1 because of the debugging and support cost while the product is unproven. It remains the intended direction.
- Local-only Collections: rejected because users expect backup and access from other devices.

## Consequences

- The privacy policy has to say plainly that data is not yet E2E encrypted.
- Admin reads are gated by role and logged.
