# Holder Card Copies are independent of Core Cards and outlive them

A Holder's Card Copy is their own record. It is never overwritten by the Owner's Core Card; the Live Version is shown *alongside* it through a Link. Holders edit only their own copy, never the Live Version. When an Owner deletes their Core Card or Account, every Link drops and Holders fall back to their own copy. Handing someone a business card entrusts them with your details, and the app can't take that back any more than you can recover a paper card.

## Considered Options

- Make the Core Card the single record and have holders reference it: rejected because Holders would lose the fact that they ever met the person when the Owner leaves, and a Holder sometimes needs details only the old card had (e.g. a support email).
- Per-field holder overrides layered on the Live Version: rejected because editing an Owner's email silently cuts the Holder off from the Owner's real, current address.

## Consequences

- Received-by-QR cards are stored as Snapshots so they persist too.
- Account deletion removes the Owner's Core Card and app data but not other Holders' copies of their card.
