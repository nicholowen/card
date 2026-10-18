import { Directory, File, Paths } from "expo-file-system";
import type { CardImageStore } from "../ports";

/**
 * Keeps card photos in the app's documents folder, which the system doesn't
 * clear. Each local Collection gets its own folder, named like its database
 * (ADR 0007), so one Account's photos never sit among another's. References
 * are paths inside the documents folder, so they survive it moving.
 */
export function fileSystemImageStore(collectionName: string): CardImageStore {
  return {
    async keep(image, name) {
      const reference = `card-images/${collectionName}/${name}.jpg`;
      new Directory(Paths.document, "card-images", collectionName).create({ intermediates: true, idempotent: true });
      await new File(image.uri).copy(new File(Paths.document, reference));
      return reference;
    },
    locate(reference) {
      return { uri: new File(Paths.document, reference).uri };
    },
  };
}
