import CardScanner from "../../../modules/card-scanner";
import type { CardImage, OcrAdapter } from "../ports";

/** On-device OCR through the card scanner module: Apple Vision on iOS, ML Kit on Android. */
export const cardScannerOcr: OcrAdapter = {
  async recognise(image) {
    return { lines: await CardScanner.recogniseTextAsync(image.uri) };
  },
};

/** Thrown when this device can't scan cards, such as the iOS simulator or a phone without Google Play services. */
export class ScannerUnavailable extends Error {
  constructor() {
    super("This device can't scan cards with the camera");
    this.name = "ScannerUnavailable";
  }
}

/**
 * Opens the system document camera, which captures the front of a card on its
 * own once the card is in view. Resolves with the photo, or null if the Holder
 * cancelled.
 */
export async function captureCardFront(): Promise<CardImage | null> {
  try {
    const uri = await CardScanner.scanCardAsync();
    return uri ? { uri } : null;
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_SCANNER_UNAVAILABLE") throw new ScannerUnavailable();
    throw error;
  }
}
