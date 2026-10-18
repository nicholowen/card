import { randomUUID } from "expo-crypto";
import { openDatabaseAsync } from "expo-sqlite";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { openCollection, type Collection } from "../collection";
import { expoSqliteDatabase } from "../collection/adapters/expo-sqlite";
import {
  apiClientNotYetAvailable,
  ocrNotYetAvailable,
  onDeviceParserNotYetAvailable,
} from "../collection/adapters/not-yet-available";

const CollectionContext = createContext<Collection | null>(null);

/**
 * One local database per Account (ADR 0007), so a second person signing in on
 * the same phone never sees the first person's Collection. Someone who hasn't
 * signed in gets their own anonymous database.
 */
function databaseName(accountId: string | null): string {
  return accountId ? `collection-${accountId}.db` : "collection-anonymous.db";
}

async function openDeviceCollection(accountId: string | null): Promise<Collection> {
  const db = await openDatabaseAsync(databaseName(accountId));
  return openCollection({
    db: expoSqliteDatabase(db),
    ocr: ocrNotYetAvailable,
    parser: onDeviceParserNotYetAvailable,
    api: apiClientNotYetAvailable,
    newId: randomUUID,
    now: () => new Date(),
  });
}

/** Opens the Collection for the signed-in Account, or the anonymous one when `accountId` is null. */
export function CollectionProvider({ accountId, children }: { accountId: string | null; children: ReactNode }) {
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCollection(null);
    openDeviceCollection(accountId).then((opened) => {
      if (!cancelled) setCollection(opened);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return <CollectionContext value={collection}>{children}</CollectionContext>;
}

/** The current Collection, or null while it is still opening. */
export function useCollection(): Collection | null {
  return use(CollectionContext);
}
