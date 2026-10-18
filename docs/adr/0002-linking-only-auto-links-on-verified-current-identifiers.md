# Auto-link only on a verified, current, personal Identifier

A Scan is linked to a Core Card automatically only when a high-Field-Confidence email (or a verified phone) exactly matches a verified, Current, non-Generic Identifier held by exactly one Core Card. Historic, unverified, fuzzy (name + company), low-confidence or contested matches only ever produce a Suggested Link. Generic Identifiers never match. Auto-links can be undone with one tap. Linking also runs retroactively when a new Core Card is verified.

Phone numbers get recycled and role inboxes get inherited by the next person in the job, so treating every Identifier match as proof of identity would quietly link cards to the wrong person. A wrong Link is worse than a missing one: it puts a stranger's details on the Holder's card.

## Consequences

- Identifiers carry a type, Current/Historic status and verified-at date.
- Two Core Cards claiming the same Identifier downgrades that match to a Suggested Link showing both.
