# Parse with on-device OCR, then a text-only LLM, with a vision fallback

OCR runs on the device (Apple Vision / ML Kit). The recognised text alone goes to a small, cheap LLM, called through our own API, which returns structured fields each with a Field Confidence. If confidence is low or OCR returns very little, the image is sent to a vision model instead. Core Colours are taken from image pixels on the device. Users without an Account get on-device parsing only: Apple's on-device model where it's available, otherwise heuristics. Scans made offline are parsed once the device reconnects.

Sending text instead of images is cheaper, faster and sends less personal data off the device. The vision fallback exists because stylised fonts, logos used as company names and vertical layouts often defeat OCR.

## Consequences

- The LLM provider has to offer zero data retention and no training on inputs.
- Android always uses the cloud LLM for now, since on-device LLM support is mostly limited to iOS.
- The fallback is two requests, not one. The app sends the text; the API answers `imageWanted` when the fields' mean Field Confidence or the text's length is below a configurable threshold; only then does the app upload the photo for a vision Parse. The photo leaves the phone only when the text wasn't enough, and the text call isn't paid for twice. A card that falls back is metered as both a text and a vision call.
