# Card App

A networking app for professionals who exchange business cards at events. People scan the cards they receive into a private Collection, and anyone can own a verified Core Card so that everyone holding their card sees their current details.

## People

**Account**:
A registered user of the app. Every piece of user data belongs to exactly one Account.
_Avoid_: User profile, member

**Owner**:
An Account that has a verified Core Card. A role an Account takes on, not a separate kind of Account.
_Avoid_: Card holder (means the opposite), publisher

**Holder**:
An Account that has a Card Copy of someone else's card in their Collection.
_Avoid_: Recipient, scanner, contact owner

**Admin**:
An Account with the admin role, allowed to view other Accounts' data for support. Every admin read is logged.
_Avoid_: Superuser, support user

## Cards

**Core Card**:
The single canonical card an Owner publishes about themselves: their chosen fields, front/back images and Core Colours. Only the Owner can edit it.
_Avoid_: Master card, main card, profile, digital card

**Card Copy**:
A Holder's own record of someone else's card, created from a Scan or a Snapshot. It belongs to the Holder, is editable only by the Holder, and survives the Owner leaving.
_Avoid_: Contact, scanned card, local card

**Snapshot**:
A Card Copy created by receiving a Core Card through a Share Link instead of scanning paper. It freezes what the Owner shared at that moment.
_Avoid_: Cached card, saved share

**Live Version**:
The Owner's current Core Card as a Holder sees it, through a Link.
_Avoid_: Main version, owner version, synced version

**My Version**:
The Holder's own Card Copy. The Holder can always switch to it, even when the copy is linked.
_Avoid_: Original, archived version, local version

**Generated Card**:
A plain Core Card made from fields and a colour, for Owners with no physical card.
_Avoid_: Template card, virtual card

**Core Colours**:
The palette that represents a card visually, taken from its images.
_Avoid_: Theme, brand colours

**Collection**:
All of a Holder's Card Copies.
_Avoid_: Contacts, address book, rolodex, wallet

## Matching

**Identifier**:
A contact detail used to recognise who a card belongs to, such as an email address or phone number. It is either Current or Historic, and either Verified or unverified.
_Avoid_: Key, handle, contact method

**Historic Identifier**:
An Identifier the Owner used in the past and keeps on their Core Card so that old paper cards still find them.
_Avoid_: Old email, previous details, alias

**Generic Identifier**:
An Identifier that is shared by many people, such as info@ or a switchboard number. It never identifies an Owner.
_Avoid_: Shared contact, role address

**Link**:
The connection from a Card Copy to a Core Card, which lets the Holder see the Live Version.
_Avoid_: Sync, claim, merge, match

**Suggested Link**:
A possible Link that the Holder has to confirm, offered when a match is weak, Historic or contested.
_Avoid_: Pending match, fuzzy link

**Unlink**:
A Holder removing a Link so that their Card Copy stands alone again.
_Avoid_: Detach, disconnect

## Capture

**Scan**:
Capturing a paper card (front, then optionally back) with the camera to create a Card Copy.
_Avoid_: Import, upload, photo

**Parse**:
Turning a Scan's recognised text into structured card fields, each with its own Field Confidence.
_Avoid_: Extract, OCR (OCR is only one step of a Parse)

**Field Confidence**:
How certain a Parse is about a single field's value.
_Avoid_: Score, accuracy

**Unsynced Card**:
A Card Copy created or changed on the device that hasn't reached the server yet.
_Avoid_: Offline card, pending card

## Organising

**Note**:
Free text a Holder writes on a Card Copy, private to that Holder.
_Avoid_: Comment, memo

**Tag**:
A free-form label a Holder applies to Card Copies, such as an industry or an event name. Never applied automatically.
_Avoid_: Category, label, folder, event

**Tag Suggestion**:
A Tag the app proposes from a card's content, such as its job title. The Holder has to accept it.
_Avoid_: Auto-tag

## Sharing

**Share Link**:
The private, rotatable address (shown as a QR code) that opens an Owner's Public Card Page. Rotating it kills the old address but never affects existing Links.
_Avoid_: QR URL, card URL, profile link

**Public Card Page**:
The web page a Share Link opens, which lets anyone without the app view the card, save it as a contact, call or email.
_Avoid_: Landing page, web card

**Visibility Tier**:
Which audience can see a Core Card field: Public (anyone with the Share Link) or Holders (Linked Holders only).
_Avoid_: Privacy level, permission
