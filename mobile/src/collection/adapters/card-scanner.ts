import CardScanner from "../../../modules/card-scanner";
import type { CardImage, OcrAdapter } from "../ports";

/** Thrown when this device can't scan cards, such as the iOS simulator or a phone without Google Play services. */
export class ScannerUnavailable extends Error {
  constructor(readonly detail: string) {
    super("This device can't scan cards with the camera");
    this.name = "ScannerUnavailable";
  }
}

/**
 * Thrown when the scanner couldn't start but may work later: on Android it can
 * still be downloading into Google Play services, which needs a connection.
 */
export class ScannerNotReady extends Error {
  constructor(readonly detail: string) {
    super("The scanner couldn't start yet");
    this.name = "ScannerNotReady";
  }
}

/** Expo Go doesn't include the app's own native modules, so scanning only works in a development build. */
const NOT_IN_THIS_BUILD =
  "The card-scanner native module isn't in this build. Expo Go doesn't include it: run a development build (npm run android / npm run ios) and start Metro without --go.";

function scanner() {
  if (!CardScanner) {
    console.error(`[card-scanner] ${NOT_IN_THIS_BUILD}`);
    throw new ScannerUnavailable(NOT_IN_THIS_BUILD);
  }
  return CardScanner;
}

/** Logs a native failure with its code and reason, which the Holder-facing message leaves out. */
function logFailure(call: string, error: unknown): string {
  const { code, message } = error as { code?: string; message?: string };
  const detail = `${code ?? "no code"}: ${message ?? String(error)}`;
  console.error(`[card-scanner] ${call} failed (${detail})`, error);
  return detail;
}

/** On-device OCR through the card scanner module: Apple Vision on iOS, ML Kit on Android. */
export const cardScannerOcr: OcrAdapter = {
  async recognise(image) {
    const module = scanner();
    try {
      return { lines: await module.recogniseTextAsync(image.uri) };
    } catch (error) {
      logFailure("recogniseTextAsync", error);
      throw error;
    }
  },
};

/**
 * Opens the system document camera, which captures the front of a card on its
 * own once the card is in view. Resolves with the photo, or null if the Holder
 * cancelled.
 */
export async function captureCardFront(): Promise<CardImage | null> {
  const module = scanner();
  try {
    const uri = await module.scanCardAsync();
    return uri ? { uri } : null;
  } catch (error) {
    const detail = logFailure("scanCardAsync", error);
    const code = (error as { code?: string }).code;
    if (code === "ERR_SCANNER_UNAVAILABLE") throw new ScannerUnavailable(detail);
    if (code === "ERR_SCANNER_NOT_READY") throw new ScannerNotReady(detail);
    throw error;
  }
}
