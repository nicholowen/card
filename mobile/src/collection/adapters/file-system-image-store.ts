import { Directory, File, Paths } from "expo-file-system";
import type { CardImageStore } from "../ports";

/**
 * Keeps card photos in the app's documents folder, which the system doesn't
 * clear. Each local Collection gets its own folder, named like its database
 * (ADR 0007), so one Account's photos never sit among another's.
 */
export function fileSystemImageStore(collectionName: string): CardImageStore {
  return {
    async keep(image, name) {
      const folder = new Directory(Paths.document, "card-images", collectionName);
      folder.create({ intermediates: true, idempotent: true });
      const kept = new File(folder, `${name}.jpg`);
      await new File(image.uri).copy(kept);
      return { uri: kept.uri };
    },
  };
}
