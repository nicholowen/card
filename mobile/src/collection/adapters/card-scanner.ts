import CardScanner from "../../../modules/card-scanner";
import type { CardImage, OcrAdapter } from "../ports";

/** On-device OCR through the card scanner module: Apple Vision on iOS, ML Kit on Android. */
export const cardScannerOcr: OcrAdapter = {
  async recognise(image) {
    if (!CardScanner) throw new ScannerUnavailable();
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
 * Thrown when the scanner couldn't start but may work later: on Android it can
 * still be downloading into Google Play services, which needs a connection.
 */
export class ScannerNotReady extends Error {
  constructor() {
    super("The scanner couldn't start yet");
    this.name = "ScannerNotReady";
  }
}

/**
 * Opens the system document camera, which captures the front of a card on its
 * own once the card is in view. Resolves with the photo, or null if the Holder
 * cancelled.
 */
export async function captureCardFront(): Promise<CardImage | null> {
  if (!CardScanner) throw new ScannerUnavailable();
  try {
    const uri = await CardScanner.scanCardAsync();
    return uri ? { uri } : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ERR_SCANNER_UNAVAILABLE") throw new ScannerUnavailable();
    if (code === "ERR_SCANNER_NOT_READY") throw new ScannerNotReady();
    throw error;
  }
}
