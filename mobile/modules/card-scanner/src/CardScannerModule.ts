import { NativeModule, requireOptionalNativeModule } from "expo";
import type { RecognisedLine } from "./CardScannerModule.types";

declare class CardScannerModule extends NativeModule<{}> {
  /**
   * Opens the system document camera (VisionKit on iOS, ML Kit on Android),
   * which finds the card's edges and captures it automatically. Resolves with
   * the photo's file address in the cache, or null if the Holder cancelled.
   * Rejects with code `ERR_SCANNER_UNAVAILABLE` on devices that can't scan,
   * such as the iOS simulator.
   */
  scanCardAsync(): Promise<string | null>;

  /** Recognises the text in a photo on the device (Apple Vision on iOS, ML Kit on Android). */
  recogniseTextAsync(uri: string): Promise<RecognisedLine[]>;
}

/**
 * The native module, or null when the app is running without it, such as in
 * Expo Go, which only includes Expo's own native modules.
 */
export default requireOptionalNativeModule<CardScannerModule>("CardScannerModule");
