import { randomUUID } from "expo-crypto";
import { openDatabaseAsync } from "expo-sqlite";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { openCollection, type Collection } from "../collection";
import { cardScannerOcr } from "../collection/adapters/card-scanner";
import { expoSqliteDatabase } from "../collection/adapters/expo-sqlite";
import { fileSystemImageStore } from "../collection/adapters/file-system-image-store";
import { heuristicParser } from "../collection/adapters/heuristic-parser";
import { apiClientNotYetAvailable } from "../collection/adapters/not-yet-available";

const CollectionContext = createContext<Collection | null>(null);

/**
 * One local database per Account (ADR 0007), so a second person signing in on
 * the same phone never sees the first person's Collection. Someone who hasn't
 * signed in gets their own anonymous database.
 */
function collectionName(accountId: string | null): string {
  return accountId ? `collection-${accountId}` : "collection-anonymous";
}

async function openDeviceCollection(accountId: string | null): Promise<Collection> {
  const name = collectionName(accountId);
  const db = await openDatabaseAsync(`${name}.db`);
  return openCollection({
    db: expoSqliteDatabase(db),
    ocr: cardScannerOcr,
    parser: heuristicParser,
    api: apiClientNotYetAvailable,
    images: fileSystemImageStore(name),
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
