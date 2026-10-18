import type { ApiClient, LocalDatabase, OcrAdapter, OnDeviceParser } from "./ports";
import { migrateLocalDatabase } from "./schema";

export type * from "./ports";

export interface CollectionDependencies {
  db: LocalDatabase;
  ocr: OcrAdapter;
  parser: OnDeviceParser;
  api: ApiClient;
  /** A new random id for a Card Copy (a UUID). */
  newId: () => string;
  /** The current time. */
  now: () => Date;
}

/** A social profile printed on a card, such as LinkedIn or Instagram. */
export interface SocialHandle {
  network: string;
  handle: string;
}

/** The fields of a card, as the Holder sees them on My Version. */
export interface CardFields {
  name?: string;
  jobTitle?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  socials?: SocialHandle[];
}

/** A Card Copy as the Collection list shows it. */
export interface CardCopySummary {
  id: string;
  name?: string;
  jobTitle?: string;
  company?: string;
  createdAt: string;
}

/** A Card Copy in full: the Holder's own record of someone's card. */
export interface CardCopy {
  id: string;
  source: "scan" | "snapshot" | "manual";
  /** My Version: the Holder's own fields for this card. */
  fields: CardFields;
  createdAt: string;
  updatedAt: string;
}

/**
 * The Holder's Collection: the single interface the UI calls for Scan → Parse
 * → save, editing My Version, Notes, Tags, search and sync (spec: Mobile modules).
 */
export interface Collection {
  list(): Promise<CardCopySummary[]>;
  /** Saves a card the Holder typed in, as a Card Copy with `source = manual`. */
  addManual(fields: CardFields): Promise<CardCopy>;
  /** One Card Copy, or null if there is no such card (or it was deleted). */
  get(id: string): Promise<CardCopy | null>;
  /** Replaces My Version's fields. Only ever touches the Holder's own copy (ADR 0001). */
  editMyVersion(id: string, fields: CardFields): Promise<CardCopy>;
  /**
   * Deletes a Card Copy from the Collection. It is tombstoned (`deleted_at`)
   * rather than removed, so the deletion can reach the server on the next sync.
   */
  delete(id: string): Promise<void>;
  /** Card Copies created, edited or deleted on this device since they last reached the server. */
  unsyncedChanges(): Promise<UnsyncedChange[]>;
}

/** A Card Copy whose latest change hasn't reached the server yet. */
export interface UnsyncedChange {
  id: string;
  updatedAt: string;
  /** Set when the change is a deletion. */
  deletedAt: string | null;
}

interface CardCopyRow {
  id: string;
  source: CardCopy["source"];
  payload: string;
  created_at: string;
  updated_at: string;
}

/** The JSON stored in `card_copy.payload` (ADR 0003: one column holds the personal fields). */
interface Payload {
  fields: CardFields;
}

export async function openCollection(deps: CollectionDependencies): Promise<Collection> {
  await migrateLocalDatabase(deps.db);

  async function get(id: string): Promise<CardCopy | null> {
    const [row] = await deps.db.all<CardCopyRow>(
      "SELECT * FROM card_copy WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    return row ? toCardCopy(row) : null;
  }

  return {
    async list() {
      const rows = await deps.db.all<CardCopyRow>(
        "SELECT * FROM card_copy WHERE deleted_at IS NULL ORDER BY created_at DESC",
      );
      return rows.map((row) => {
        const { fields } = readPayload(row);
        return {
          id: row.id,
          name: fields.name,
          jobTitle: fields.jobTitle,
          company: fields.company,
          createdAt: row.created_at,
        };
      });
    },

    async addManual(typed) {
      const fields = cleanFields(typed);
      const now = deps.now().toISOString();
      const card: CardCopy = { id: deps.newId(), source: "manual", fields, createdAt: now, updatedAt: now };
      const payload: Payload = { fields: card.fields };
      await deps.db.execute(
        "INSERT INTO card_copy (id, source, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [card.id, card.source, JSON.stringify(payload), card.createdAt, card.updatedAt],
      );
      return card;
    },

    get,

    async editMyVersion(id, typed) {
      const fields = cleanFields(typed);
      const existing = await get(id);
      if (!existing) throw new CardCopyNotFound(id);
      const card: CardCopy = { ...existing, fields, updatedAt: deps.now().toISOString() };
      const payload: Payload = { fields: card.fields };
      await deps.db.execute("UPDATE card_copy SET payload = ?, updated_at = ? WHERE id = ?", [
        JSON.stringify(payload),
        card.updatedAt,
        id,
      ]);
      return card;
    },

    async delete(id) {
      const now = deps.now().toISOString();
      await deps.db.execute(
        "UPDATE card_copy SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
        [now, now, id],
      );
    },

    async unsyncedChanges() {
      const rows = await deps.db.all<{ id: string; updated_at: string; deleted_at: string | null }>(
        `SELECT id, updated_at, deleted_at FROM card_copy
         WHERE synced_at IS NULL OR updated_at > synced_at
         ORDER BY updated_at`,
      );
      return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at, deletedAt: row.deleted_at }));
    },
  };
}

/** Thrown when a card would be saved with no details at all. */
export class EmptyCard extends Error {
  constructor() {
    super("A card needs at least one detail");
    this.name = "EmptyCard";
  }
}

const TEXT_FIELDS = ["name", "jobTitle", "company", "email", "phone", "website", "address"] as const;

/** Trims what the Holder typed and leaves out anything blank. */
function cleanFields(typed: CardFields): CardFields {
  const fields: CardFields = {};
  for (const key of TEXT_FIELDS) {
    const value = typed[key]?.trim();
    if (value) fields[key] = value;
  }
  const socials = (typed.socials ?? [])
    .map((social) => ({ network: social.network.trim(), handle: social.handle.trim() }))
    .filter((social) => social.handle !== "");
  if (socials.length > 0) fields.socials = socials;

  if (Object.keys(fields).length === 0) throw new EmptyCard();
  return fields;
}

/** Thrown when a Card Copy doesn't exist or has been deleted. */
export class CardCopyNotFound extends Error {
  constructor(id: string) {
    super(`No Card Copy with id ${id}`);
    this.name = "CardCopyNotFound";
  }
}

function toCardCopy(row: CardCopyRow): CardCopy {
  return {
    id: row.id,
    source: row.source,
    fields: readPayload(row).fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readPayload(row: CardCopyRow): Payload {
  return JSON.parse(row.payload) as Payload;
}
