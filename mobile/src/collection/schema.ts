import type { LocalDatabase } from "./ports";

// Local schema migrations, applied in order and tracked with PRAGMA user_version.
// Append new migrations; never edit one that has shipped.
const MIGRATIONS: string[] = [
  `CREATE TABLE card_copy (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('scan', 'snapshot', 'manual')),
    payload TEXT NOT NULL,
    core_colours TEXT,
    parsed_by TEXT CHECK (parsed_by IN ('device', 'cloud-text', 'cloud-vision')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    synced_at TEXT
  )`,
  // The photo of a scanned card's front, as a file address on this device.
  `ALTER TABLE card_copy ADD COLUMN front_image TEXT`,
];

export async function migrateLocalDatabase(db: LocalDatabase): Promise<void> {
  const [row] = await db.all<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.execute(MIGRATIONS[version]!);
    await db.execute(`PRAGMA user_version = ${version + 1}`);
  }
}
