# Card v1 spec

Uses the vocabulary in `CONTEXT.md` and respects ADRs 0001–0006.

## Problem Statement

Professionals at networking events come home with a pocketful of paper business cards. They type a few into their phone, lose the rest, and forget where they met whom. The cards they do keep go stale: people change jobs, emails and titles, so a card handed out six months ago may point to an inbox nobody reads. The person who handed the card out has no way to correct it. Existing digital-card apps only help when *both* people already have the same app, and they treat the other person's paper card as a dead end.

## Solution

A mobile app that turns any paper business card into a searchable Card Copy in seconds, using on-device OCR and a cheap LLM Parse, and lets the Holder organise their Collection with Notes and Tags. Anyone can also claim a verified Core Card for themselves. When a Holder scans a card that belongs to a verified Owner (including one of that Owner's *old* cards), the Card Copy is Linked to the Owner's Core Card, so the Holder sees the Live Version and the Owner's updates reach everyone who holds their card. The Holder's own copy (My Version) is always kept and always viewable, even if the Owner leaves. Owners share their card with a QR code that opens a Public Card Page, so the recipient can save the contact, call or email even without the app.

## User Stories

### Scanning and Parsing

1. As a Holder, I want to point my camera at a business card and have it captured automatically, so that I can scan cards quickly at an event.
2. As a Holder, I want the card's text recognised on my device, so that scanning works quickly and doesn't send images off my phone unnecessarily.
3. As a Holder, I want the recognised text turned into fields (name, job title, company, email, phone, website, address, social handles), so that I don't have to type anything.
4. As a Holder, I want low-confidence fields highlighted, so that I know which ones to double-check.
5. As a Holder, I want to correct any field before saving, so that OCR mistakes don't end up in my Collection.
6. As a Holder, I want to be offered a scan of the back of the card after the front, so that details printed on the back are captured too.
7. As a Holder, I want to skip the back-of-card scan, so that single-sided cards don't slow me down.
8. As a Holder, I want cards with unusual fonts or layouts to still parse correctly, so that I'm not stuck retyping stylised cards.
9. As a Holder, I want the photo of the card kept with my Card Copy, so that I can see the original design later.
10. As a Holder, I want each Card Copy's Core Colours taken from the card, so that my Collection is visually recognisable.
11. As a Holder, I want to scan cards with no signal, so that a basement conference hall doesn't stop me.
12. As a Holder, I want cards scanned offline to be parsed automatically once I'm back online, so that I don't have to redo them.
13. As a Holder without an Account, I want scanning to still work using on-device parsing, so that I can try the app before signing up.
14. As a Holder, I want to know when a card was parsed on the device only, so that I understand why it might be less accurate.
15. As a Holder, I want to enter a card by hand, so that I can add a contact whose card I don't have.

### Collection

16. As a Holder, I want every scanned card saved to my Collection, so that all my business contacts are in one place.
17. As a Holder, I want my business contacts kept separate from my phone's personal contacts, so that my personal address book doesn't fill up with event contacts.
18. As a Holder, I want to search my Collection by name, company, job title, email, Tag or Note text, so that I can find someone from a fragment I remember.
19. As a Holder, I want search to tolerate typos and partial matches, so that "Jon Smth" finds "John Smith".
20. As a Holder, I want to sort my Collection by name, company or date added, so that I can browse it the way I think of it.
21. As a Holder, I want to filter my Collection by Tag, so that I can see everyone from one event or industry.
22. As a Holder, I want search to work offline, so that I can look someone up anywhere.
23. As a Holder, I want to call, email or open the website of a contact with one tap, so that I can follow up straight away.
24. As a Holder, I want to delete a Card Copy, so that I can remove people I don't need to keep.
25. As a Holder, I want to edit My Version of any card at any time, so that I can fix mistakes I notice later.

### Notes and Tags

26. As a Holder, I want to write a Note on a Card Copy, such as "met at SecurityCon, wants to talk about pen testing", so that I remember the context.
27. As a Holder, I want my Notes to be private to me, so that I can write candidly.
28. As a Holder, I want to add free-form Tags to a Card Copy, such as "Finance" or "PWI Launch Event", so that I can group contacts my own way.
29. As a Holder, I want to reuse Tags I've already created via autocomplete, so that I don't end up with duplicates like "IT" and "it".
30. As a Holder, I want Tag Suggestions based on a card's content (e.g. its job title or industry), so that tagging is faster.
31. As a Holder, I want Tag Suggestions to never be applied without my say-so, so that my Tags stay meaningful.
32. As a Holder, when I add a Tag or Note to one card, I want to be offered "also add to the other N cards you scanned today?" with each card ticked by default, so that I can tag a whole event in one step.
33. As a Holder, I want to untick individual cards in that prompt, so that I only tag the right people.
34. As a Holder, I want to rename or delete a Tag everywhere it's used, so that I can tidy up my Tags.

### Accounts and Sync

35. As a person, I want to sign up with Google, Apple or an email code, so that getting started is quick.
36. As a Holder, I want my Collection backed up to my Account, so that losing my phone doesn't lose my contacts.
37. As a Holder, I want my Collection on every device I sign in on, so that I can switch phones.
38. As a Holder, I want to see which cards are Unsynced, so that I know what isn't backed up yet.
39. As a Holder, I want to be prompted to sync when I open the app with a connection and have Unsynced Cards, so that nothing stays only on my phone by accident.
40. As a Holder who scanned cards before signing up, I want them uploaded to my new Account, so that nothing I scanned is lost.
41. As an Account, I want to delete my Account and all my data from inside the app, so that I'm in control of what's stored about me.
42. As an Account, I want a clear explanation of what data is stored and that it isn't end-to-end encrypted yet, so that I can make an informed choice.

### Core Card

43. As an Owner, I want to create my Core Card by scanning or uploading my own card, so that it starts with my real design and details.
44. As an Owner, I want to add the back of my card to my Core Card, so that the full design is shown.
45. As an Owner without a physical card, I want to create a Generated Card from my details and a colour, so that I can still share a card.
46. As an Owner, I want to add details that aren't on my paper card (e.g. LinkedIn, a second phone), so that my Core Card is more complete than paper.
47. As an Owner, I want to verify my email with a one-time code, so that people can trust my Core Card really is me.
48. As an Owner, I want my Core Card to become linkable only once I've verified, so that nobody can impersonate me before then.
49. As an Owner, I want to edit my Core Card at any time, so that everyone holding my card gets my current details.
50. As an Owner, I want to set each field's Visibility Tier to Public or Holders, so that I control who sees what.
51. As an Owner, I want to add Historic Identifiers (old emails, old numbers), so that old paper cards I've handed out still find me.
52. As an Owner, I want to mark an Identifier as Current or Historic when I change jobs, so that matching stays accurate.
53. As an Owner, I want to see how many times my card has been viewed and saved, as counts only, so that I can tell whether it's being used without seeing who.
54. As an Owner, I want to delete my Core Card without deleting my Account, so that I can stop publishing my card but keep my Collection.

### Matching and Linking

55. As a Holder, when I scan the card of a verified Owner, I want it automatically Linked to their Core Card, so that I see their current details.
56. As a Holder, I want an automatic Link shown clearly ("Linked to Owen's live card"), with one-tap undo, so that I stay in control without being slowed down.
57. As a Holder, I want a Suggested Link when the match is less certain, so that I can confirm it's the right person.
58. As a Holder, I want to dismiss a Suggested Link, so that wrong matches don't keep coming back.
59. As a Holder, when I scan an old card whose email is out of date but whose phone number matches an Owner's Historic Identifier, I want to be offered a Link to their Core Card, so that I reach the person I actually met.
60. As a Holder, I want cards with only generic contact details (info@, a switchboard number) never to be linked, so that I'm not linked to the wrong person.
61. As a Holder, when two Core Cards claim the same contact detail, I want to choose between them, so that the app doesn't guess.
62. As a Holder, I want to switch between the Live Version and My Version of a Linked card, so that I can still see details only the old card had, such as a support email.
63. As a Holder, I want to Unlink a card, so that I can keep only My Version.
64. As a Holder, when someone I've already scanned later joins and verifies, I want my existing Card Copy to become Linked (using the same rules), so that old scans become live too.
65. As a Holder, I want a quiet notice when contacts in my Collection gain Live Versions, so that I know without being interrupted.
66. As a Holder, I want an "updated" marker on Linked cards whose Owner changed something since I last looked, so that I notice job changes.
67. As a Holder, I want to be unable to edit someone's Live Version, so that I can't accidentally cut myself off from their real details.

### Sharing

68. As an Owner, I want to show a QR code of my Share Link in the app, so that people can scan it with any phone camera.
69. As someone without the app, I want scanning an Owner's QR code to open a Public Card Page, so that I can see their card in the browser.
70. As someone without the app, I want to save the card to my phone contacts from the Public Card Page with one tap, so that I have their details within seconds.
71. As someone without the app, I want to call or email the Owner straight from the Public Card Page, so that I can reach them right away.
72. As a visitor to the Public Card Page, I want to see only the Owner's Public fields, so that the Owner's privacy choices are respected.
73. As a visitor, I want a link to get the app to keep the card up to date, so that I know that's possible.
74. As a Holder with the app, I want scanning an Owner's QR code in the app to add them to my Collection as a Linked Snapshot, so that I keep what they shared and also see their Live Version.
75. As an Owner, I want to rotate my Share Link, so that a QR code that's spread too widely stops working without affecting people who already hold my card.
76. As a visitor to a rotated or deleted Share Link, I want a clear "this card is no longer available" page, so that I'm not confused.

### Owner Departure

77. As a Holder, when an Owner deletes their Core Card or Account, I want my Card Copy to remain with My Version, so that I don't lose the record of meeting them.
78. As a Holder, I want a notice when a Linked Owner has removed their live card, so that I understand why the Live Version disappeared.
79. As a departing Owner, I want my Core Card, Identifiers, Share Link and all my own data removed, so that my request to leave is honoured.

### Support and Admin

80. As the Admin, I want to look up an Account's data for support, so that I can help users debug problems.
81. As the Admin, I want every admin read recorded in an audit log, so that support access is accountable.
82. As a non-admin Account, I want to be unable to see anyone else's Collection, Notes or Tags, so that my data stays private.

### Analytics

83. As the developer, I want aggregate product metrics (scans per day, Parse success rate, fallback rate, Link rate), so that I can tell whether the app works and gets used.
84. As the developer, I want no third-party trackers on the Public Card Page, so that the page stays light and private.

## Implementation Decisions

### Shape of the system

- Two deployables: the **mobile app** (Expo / React Native and TypeScript, iOS and Android) and the **API** (a Node + TypeScript service on Postgres, with Better Auth and the Public Card Page server-rendered from the same service). Hosted in Sydney (ADR 0005).
- The API is the system of record for Accounts, Core Cards, Identifiers, Links and synced Card Copies. The mobile app is offline-first with a local SQLite database (ADR 0006).

### API modules

- **Auth**: Better Auth with Google, Apple and email OTP. Accounts carry a role (`member` | `admin`). Email OTP is also how Core Card Identifiers get verified.
- **Parse**: accepts the OCR text (plus optional image) for a Scan and returns structured fields, each with a Field Confidence. It tries a text-only LLM call first and falls back to a vision call when overall confidence or text length is below a threshold (ADR 0004). The LLM provider sits behind a port so tests can swap in a fake, and must offer zero data retention. Each call is metered per Account.
- **Core Cards**: create/update/delete the Owner's Core Card, its images, Core Colours, fields with Visibility Tiers, and Identifiers (type, value, Current/Historic, verified-at). One Core Card per Account.
- **Matching**: given a Card Copy's parsed Identifiers and Field Confidences, returns one of `auto-link(coreCardId)`, `suggest([coreCardId…])` or `none`, following ADR 0002. A deep module with a small interface that also drives retroactive linking when a Core Card becomes verified (by matching existing Card Copies' hashed Identifiers).
- **Generic Identifier detection**: a rule set (role-style local parts such as info/sales/hello/admin, and numbers shared by several Core Cards) feeding Matching.
- **Collection sync**: per-Account push/pull of Card Copies, Notes and Tags, with last-write-wins per record using a client-supplied updated-at and a server revision cursor for pulls.
- **Sharing**: Share Link issuing and rotation (random, unguessable slug; rotating replaces it). The Public Card Page renders Public fields only and serves a vCard download. It counts views and saves as aggregate events.
- **Account deletion**: one entry point that deletes everything owned by the Account by cascade, removes its storage prefix, deletes its Core Card (which drops all Links pointing at it) and records "Owner departed" notices for affected Holders.
- **Admin**: role-gated read endpoints; every call writes an audit-log row (admin, target Account, endpoint, time).
- **Analytics**: aggregate event counters only (no viewer identity), stored first-party.

### Schema (shape, not DDL)

- Every user-data table carries `account_id` (directly, or through a parent that does) with cascade delete (ADR 0003).
- **card_copy**: `id`, `account_id`, `source` (`scan` | `snapshot` | `manual`), `payload` (JSON: fields + Field Confidences), `core_colours`, image references, `parsed_by` (`device` | `cloud-text` | `cloud-vision`), `created_at`, `updated_at`, `deleted_at` (tombstone for sync).
- **card_link**: `card_copy_id`, `core_card_id`, `kind` (`auto` | `confirmed`), `last_seen_core_revision`, plus a separate store of dismissed suggestions. This is the only table that references across Accounts.
- **core_card**: `id`, `account_id`, field set with per-field Visibility Tier, images, `core_colours`, `revision`, `verified_at`.
- **identifier**: `core_card_id`, `type` (`email` | `phone`), normalised value, keyed hash of the normalised value, `status` (`current` | `historic`), `verified_at`. Matching queries by hash.
- **note** and **tag** / **card_copy_tag**: owned by the Holder's Account.
- **share_link**: `core_card_id`, `slug`, `active`.
- **admin_audit**, **analytics_event** (aggregate), **owner_departed_notice**.

### Mobile modules

- **Collection** (main seam): the interface the UI calls to Scan → Parse → save, edit My Version, Notes, Tags (including the same-day "add to the other N cards" prompt and Tag Suggestions), search/sort/filter, switch between Live Version and My Version, Unlink, and report Unsynced Cards / trigger sync. It depends on adapters for OCR, on-device parsing, the API client and local storage.
- **OCR adapter**: Apple Vision on iOS and ML Kit on Android, via an Expo dev-build native module.
- **On-device parse adapter**: Apple's on-device model where available, otherwise heuristics (regexes for email/phone/URL plus layout rules).
- **Core Colours**: pixel sampling on the device from the captured image.
- **Fuzzy search**: runs on the device against local SQLite (FTS plus trigram-style similarity).

### Interactions

- Scan flow: capture front → OCR → Parse (cloud if signed in and online, otherwise on device; queued for cloud when offline) → review screen with low-confidence fields flagged → optional back scan → save → Matching runs during sync (or right away if online) → the Link result is shown on the card.
- QR in-app receive: create a `snapshot` Card Copy from the Owner's Public + Holder fields at that moment, plus a confirmed Link.
- Live Version updates reach Holders on sync. A card shows the "updated" marker when the Core Card's `revision` is greater than the Link's `last_seen_core_revision`.

## Testing Decisions

- **What counts as a good test**: it exercises behaviour through a public seam and asserts on observable results (HTTP responses, rows a later request can read, what the Collection interface returns). No asserting on internal function calls, query shapes or private state. Tests read like the user stories.
- **Seam 1: the API over HTTP**, against a real Postgres (per-test transaction or schema), with the LLM provider, email sender and object storage replaced by in-process fakes. It covers Parse (text-first and vision fallback, Field Confidence passthrough, metering), Matching and Linking (every ADR 0002 case: verified current exact match, Historic, unverified, Generic, contested, low confidence, retroactive), Core Card verification and Visibility Tiers, Share Link rotation, the Public Card Page and vCard content, sync (push/pull, last-write-wins, tombstones), Account deletion (cascade completeness, Holders keep My Version, notices created), and admin gating plus audit rows.
- **Seam 2: the mobile Collection module**, with in-memory SQLite, a fake OCR adapter, a fake on-device parser and a fake API client. It covers offline Scan and queued Parse, Unsynced Card reporting and the sync prompt, editing My Version without touching the Live Version, Notes, Tags, the same-day tag prompt, Tag Suggestions that are never auto-applied, fuzzy search, and Live/My Version switching and Unlink.
- Deletion completeness gets a dedicated test: create an Account with data in every table, delete it, and assert that no row anywhere still references it. This guards ADR 0003 as new tables are added.
- Not covered by automated tests: UI screens, the real camera/OCR and on-device models. These get manual device testing with a fixed set of sample card photos.
- Prior art: none yet, since this is a new codebase. These two suites become the pattern later work follows.

## Out of Scope

- End-to-end encryption (planned; ADR 0003 keeps it possible)
- A web management surface for Holders, and CSV export
- Syncing Card Copies into the phone's contacts
- Calendar / Outlook / CRM integrations
- Card templates and a card designer beyond the plain Generated Card
- SMS / phone verification (phone Identifiers only produce Suggested Links until verified)
- Teams/organisations issuing cards to staff
- Event clustering, geolocation and smarter batch detection
- Paid tiers, paywalls and owner-facing analytics beyond simple counts
- SSO and cross-app identity (Better Auth leaves the door open)
- Apple/Google Wallet passes, NFC

## Further Notes

- The privacy policy must state plainly that data is stored in Sydney, is not yet E2E encrypted, can be fully deleted from inside the app, and that card text is sent to an LLM provider with zero data retention.
- Choose the LLM provider by verifying its zero-data-retention and no-training terms at the time. Prefer a small, fast text model with a vision-capable sibling.
- Normalisation rules (emails lowercased and trimmed; phones converted to E.164 using the device region as the default country) must be identical on the device and the server, because the keyed hashes depend on them.
- Per-Account metering of Parse calls exists from day one so a free-tier limit can be added later without schema changes.
