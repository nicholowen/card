import type { ApiClient, LocalDatabase, OcrAdapter, OnDeviceParser } from "./ports";
import { migrateLocalDatabase } from "./schema";

export type * from "./ports";

export interface CollectionDependencies {
  db: LocalDatabase;
  ocr: OcrAdapter;
  parser: OnDeviceParser;
  api: ApiClient;
}

/** A Card Copy as the Collection list shows it. */
export interface CardCopySummary {
  id: string;
  createdAt: string;
}

/**
 * The Holder's Collection: the single interface the UI calls for Scan → Parse
 * → save, editing My Version, Notes, Tags, search and sync (spec: Mobile modules).
 */
export interface Collection {
  list(): Promise<CardCopySummary[]>;
}

export async function openCollection(deps: CollectionDependencies): Promise<Collection> {
  await migrateLocalDatabase(deps.db);

  return {
    async list() {
      const rows = await deps.db.all<{ id: string; created_at: string }>(
        "SELECT id, created_at FROM card_copy WHERE deleted_at IS NULL ORDER BY created_at DESC",
      );
      return rows.map((row) => ({ id: row.id, createdAt: row.created_at }));
    },
  };
}
