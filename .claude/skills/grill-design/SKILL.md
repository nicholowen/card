---
name: grill-design
description: Grill Owen on the Card App's UI/UX, then write the design brief that the styling work follows.
disable-model-invocation: true
---

Run a design interview for the Card App and end with a written design brief at `docs/design/brief.md`. The brief is what the theme tokens and the styling pass (see the open tickets) build from, so every decision in it must come from Owen's answers.

## How to run it

1. Read `CONTEXT.md` and use its vocabulary in every question (Collection, Card Copy, Core Card, Live Version, My Version, Scan, Holder, Owner). If `docs/design/brief.md` already exists, read it: this run revisits or extends it, and its settled decisions start as settled.
2. Send a sub-agent to survey the app as it stands: every screen in `mobile/src/app`, the components in `mobile/src/components`, and the colours, type and spacing they use. Facts come from the code, never from Owen. Start round 1 while it runs; questions about current screens wait for its report.
3. Interview with the `grilling` skill's method: the design tree below, worked in rounds of the current frontier, every question numbered with your recommended answer. Your recommendations take a point of view. Use the `frontend-design` skill's lens: a choice made for this subject and audience, never the default any app would get.
4. When a branch can't be settled in words (two palettes, two layouts for the Collection), show it. Draw the options inline, or use the `prototype` skill for a throwaway screen, and ask Owen to pick.
5. The interview is done when the frontier is empty and Owen confirms the shared understanding. Then write the brief (format below), and commit it.

## The design tree

The root is **identity**; most other branches hang off it. Ask root branches first.

- **Identity** (root): who opens this app and where (a networker, at a loud event, one hand, low light, poor signal; later at a desk, following up). Three words for how it should feel. The **legacy tells** Owen wants gone: name specific card-scanner and contacts apps, and what in each reads as dated. Apps outside the category Owen admires, and the exact thing he admires in each.
- **The card as object**: whether a Card Copy shows as the card itself (its photo, its Core Colours, its proportions) or as a contact row. How the Collection reads at 10 cards and at 500. How a Linked card, the Live Version vs My Version switch, an Unsynced Card and the "updated" marker look, so status reads at a glance.
- **Colour**: how much the app's own palette steps back so each card's Core Colours lead. Accent colour and what it marks. Light, dark, or both from launch.
- **Type**: system fonts (native feel, dynamic type for free) or a custom face (more character, more cost). The scale, and how card text, which may be in any script, sits inside it.
- **Navigation and layout**: how Scan is reached in one move from anywhere. Where search lives. Tabs, a single stack, or something else. One-handed reach at an event.
- **The Scan flow**: the capture moment, the review screen, how low Field Confidence is flagged, and how it says a card was parsed on the device only. How fast it should feel, and what feedback (haptics, sound, motion) confirms a save.
- **The memorable moment**: the one place the app spends its boldness: a card landing in the Collection, a card becoming Linked, showing a QR across a room. Everything else stays quiet.
- **Owner side**: editing the Core Card, the Visibility Tier choice, and the QR screen (full-screen, bright, readable at arm's length).
- **Public Card Page**: the first thing a person without the app ever sees. How it carries the Owner's card design and how much of the app's own identity it shows.
- **Voice**: how the app talks: labels, empty Collection, offline, errors, the Owner-departed notice.
- **Platform and access**: one look on iOS and Android, or native conventions on each. Contrast, dynamic type, reduced motion and screen readers as the floor.

Each answer may open new branches (a dark mode answer opens how card photos sit on a dark background). Add them to the tree as they appear; the interview covers those too.

## The brief

`docs/design/brief.md` holds decisions, each in a sentence or two with its reason. Sections:

- **Point of view**: the three words, the audience and setting, and the one memorable moment.
- **Anti-references**: the legacy tells by name, so later work can check against them.
- **Tokens**: palette as named roles with hex values (light and dark if both), type faces and scale, spacing scale, corner radii and where each applies, elevation, motion durations and easing. The theme ticket turns this section into code, so make every value concrete.
- **Screens**: per screen (Collection, card detail, Scan and review, Core Card editor, QR, sign-in, Public Card Page), its layout and anything specific to it.
- **Voice**: tone, plus the empty, offline and error copy patterns.
- **Open questions**: anything Owen deferred, with who decides and when.
