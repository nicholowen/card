import type {
  ApiClient,
  CardImage,
  CardImageStore,
  LocalDatabase,
  OcrAdapter,
  OnDeviceParser,
  ParsedFields,
} from "./ports";
import { SOCIAL_FIELD_PREFIX } from "./ports";
import { migrateLocalDatabase } from "./schema";

export type * from "./ports";
export { socialFieldKey } from "./ports";

export interface CollectionDependencies {
  db: LocalDatabase;
  ocr: OcrAdapter;
  parser: OnDeviceParser;
  api: ApiClient;
  images: CardImageStore;
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

/** The single-line text fields of a card, in display order. */
export const CARD_TEXT_FIELDS = ["name", "jobTitle", "company", "email", "phone", "website", "address"] as const;
export type CardTextField = (typeof CARD_TEXT_FIELDS)[number];

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
export interface CardCopySummary extends Pick<CardFields, "name" | "jobTitle" | "company"> {
  id: string;
  createdAt: string;
}

/** A Card Copy in full: the Holder's own record of someone's card. */
export interface CardCopy {
  id: string;
  source: "scan" | "snapshot" | "manual";
  /** Where a scanned card was parsed. Unset for cards that weren't parsed, such as ones typed in by hand. */
  parsedBy?: ParsedBy;
  /** My Version: the Holder's own fields for this card. */
  fields: CardFields;
  /** The photo of a scanned card's front, kept on this device. */
  frontImage?: CardImage;
  createdAt: string;
  updatedAt: string;
}

/** Where a card was parsed: on the device, or in the cloud from its text or its image (ADR 0004). */
export type ParsedBy = "device" | "cloud-text" | "cloud-vision";

/** A scanned card waiting for the Holder to check its fields and save it. */
export interface ScanReview {
  /** The photo of the card's front, still in the camera's cache. */
  front: CardImage;
  /** The fields the Parse found, for the Holder to correct. */
  fields: CardFields;
  /** Fields whose Field Confidence is low, in display order, for the Holder to double-check. */
  needsChecking: CardTextField[];
  /** The Field Confidence of each field the Parse found, keyed as the Parse keyed them. */
  fieldConfidences: Record<string, number>;
}

/** Below this Field Confidence, a field is flagged for the Holder to check. */
const CHECK_BELOW_CONFIDENCE = 0.6;

/**
 * The Holder's Collection: the single interface the UI calls for Scan → Parse
 * → save, editing My Version, Notes, Tags, search and sync (spec: Mobile modules).
 */
export interface Collection {
  list(): Promise<CardCopySummary[]>;
  /** Saves a card the Holder typed in, as a Card Copy with `source = manual`. */
  addManual(fields: CardFields): Promise<CardCopy>;
  /** Reads a photo of a card's front and parses it, for the Holder to review before saving. */
  scan(front: CardImage): Promise<ScanReview>;
  /**
   * Saves a reviewed scan to the Collection as a Card Copy with `source = scan`,
   * using the fields as the Holder corrected them and keeping the card's photo.
   */
  saveScan(review: ScanReview, fields: CardFields): Promise<CardCopy>;
  /** One Card Copy, or null if there is no such card (or it was deleted). */
  get(id: string): Promise<CardCopy | null>;
  /** Replaces My Version's fields. Only ever touches the Holder's own copy (ADR 0001). */
  editMyVersion(id: string, fields: CardFields): Promise<CardCopy>;
  /**
   * Deletes a Card Copy from the Collection. It is tombstoned (`deleted_at`)
   * rather than removed, so the deletion can reach the server on the next sync.
   */
  delete(id: string): Promise<void>;
  /** Unsynced Cards: Card Copies created, edited or deleted on this device since they last reached the server. */
  unsyncedCards(): Promise<UnsyncedCard[]>;
}

/** A Card Copy whose latest change, possibly its deletion, hasn't reached the server yet. */
export interface UnsyncedCard {
  id: string;
  updatedAt: string;
  /** Set when the change is a deletion. */
  deletedAt: string | null;
}

interface CardCopyRow {
  id: string;
  source: CardCopy["source"];
  parsed_by: ParsedBy | null;
  payload: string;
  front_image: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The JSON stored in `card_copy.payload` (ADR 0003: one column holds the
 * personal fields). Later sources add more keys.
 */
interface Payload {
  fields: CardFields;
  /** A scanned card's Field Confidences as the Parse found them, before the Holder's corrections. */
  fieldConfidences?: Record<string, number>;
  [key: string]: unknown;
}

export async function openCollection(deps: CollectionDependencies): Promise<Collection> {
  await migrateLocalDatabase(deps.db);

  async function getRow(id: string): Promise<CardCopyRow | undefined> {
    const [row] = await deps.db.all<CardCopyRow>(
      "SELECT * FROM card_copy WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    return row;
  }

  async function get(id: string): Promise<CardCopy | null> {
    const row = await getRow(id);
    return row ? toCardCopy(row, deps.images) : null;
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
      await deps.db.execute(
        "INSERT INTO card_copy (id, source, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [card.id, card.source, writePayload({ fields }), card.createdAt, card.updatedAt],
      );
      return card;
    },

    async scan(front) {
      const recognised = await deps.ocr.recognise(front);
      const parsed = await deps.parser.parse(recognised);
      const fields = toCardFields(parsed);
      return {
        front,
        fields,
        needsChecking: CARD_TEXT_FIELDS.filter(
          (key) => fields[key] !== undefined && parsed[key]!.confidence < CHECK_BELOW_CONFIDENCE,
        ),
        fieldConfidences: Object.fromEntries(Object.entries(parsed).map(([key, field]) => [key, field.confidence])),
      };
    },

    async saveScan(review, corrected) {
      const fields = cleanFields(corrected);
      const id = deps.newId();
      const frontImageReference = await deps.images.keep(review.front, `${id}-front`);
      const now = deps.now().toISOString();
      const card: CardCopy = {
        id,
        source: "scan",
        parsedBy: "device",
        fields,
        frontImage: deps.images.locate(frontImageReference),
        createdAt: now,
        updatedAt: now,
      };
      await deps.db.execute(
        `INSERT INTO card_copy (id, source, parsed_by, payload, front_image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          card.source,
          card.parsedBy!,
          writePayload({ fields, fieldConfidences: review.fieldConfidences }),
          frontImageReference,
          now,
          now,
        ],
      );
      return card;
    },

    get,

    async editMyVersion(id, typed) {
      const fields = cleanFields(typed);
      const row = await getRow(id);
      if (!row) throw new CardCopyNotFound(id);
      const updatedAt = deps.now().toISOString();
      // Replace only the fields, keeping anything else the payload carries.
      const payload: Payload = { ...readPayload(row), fields };
      await deps.db.execute("UPDATE card_copy SET payload = ?, updated_at = ? WHERE id = ?", [
        writePayload(payload),
        updatedAt,
        id,
      ]);
      return { ...toCardCopy(row, deps.images), fields, updatedAt };
    },

    async delete(id) {
      const now = deps.now().toISOString();
      await deps.db.execute(
        "UPDATE card_copy SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
        [now, now, id],
      );
    },

    async unsyncedCards() {
      const rows = await deps.db.all<{ id: string; updated_at: string; deleted_at: string | null }>(
        `SELECT id, updated_at, deleted_at FROM card_copy
         WHERE synced_at IS NULL OR updated_at > synced_at
         ORDER BY updated_at`,
      );
      return rows.map((row) => ({ id: row.id, updatedAt: row.updated_at, deletedAt: row.deleted_at }));
    },
  };
}

/** Turns a Parse's fields into card fields, leaving out any it found empty or doesn't know. */
function toCardFields(parsed: ParsedFields): CardFields {
  const fields: CardFields = {};
  for (const key of CARD_TEXT_FIELDS) {
    const value = parsed[key]?.value.trim();
    if (value) fields[key] = value;
  }
  const socials = Object.entries(parsed)
    .filter(([key]) => key.startsWith(SOCIAL_FIELD_PREFIX))
    .map(([key, field]) => ({ network: key.slice(SOCIAL_FIELD_PREFIX.length), handle: field.value.trim() }))
    .filter((social) => social.handle !== "");
  if (socials.length > 0) fields.socials = socials;
  return fields;
}


/** Thrown when a card would be saved with no details at all. */
export class CardHasNoDetails extends Error {
  constructor() {
    super("A card needs at least one detail");
    this.name = "CardHasNoDetails";
  }
}

/** Trims what the Holder typed and leaves out anything blank. */
function cleanFields(typed: CardFields): CardFields {
  const fields: CardFields = {};
  for (const key of CARD_TEXT_FIELDS) {
    const value = typed[key]?.trim();
    if (value) fields[key] = value;
  }
  const socials = (typed.socials ?? [])
    .map((social) => ({ network: social.network.trim(), handle: social.handle.trim() }))
    .filter((social) => social.handle !== "");
  if (socials.length > 0) fields.socials = socials;

  if (Object.keys(fields).length === 0) throw new CardHasNoDetails();
  return fields;
}

/** Thrown when a Card Copy doesn't exist or has been deleted. */
export class CardCopyNotFound extends Error {
  constructor(id: string) {
    super(`No Card Copy with id ${id}`);
    this.name = "CardCopyNotFound";
  }
}

function toCardCopy(row: CardCopyRow, images: CardImageStore): CardCopy {
  return {
    id: row.id,
    source: row.source,
    ...(row.parsed_by ? { parsedBy: row.parsed_by } : {}),
    fields: readPayload(row).fields,
    ...(row.front_image ? { frontImage: images.locate(row.front_image) } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function writePayload(payload: Payload): string {
  return JSON.stringify(payload);
}

/** What the Collection list and card screen call a card: its name, else its company. */
export function cardDisplayName(fields: Pick<CardFields, "name" | "company">): string {
  return fields.name ?? fields.company ?? "Unnamed card";
}

function readPayload(row: CardCopyRow): Payload {
  return JSON.parse(row.payload) as Payload;
}
