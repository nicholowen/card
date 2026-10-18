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

async function openDeviceCollection(accountId: string): Promise<Collection> {
  // One local database per Account, so a second person signing in on the
  // same phone never sees the first person's Collection.
  const db = await openDatabaseAsync(`collection-${accountId}.db`);
  return openCollection({
    db: expoSqliteDatabase(db),
    ocr: ocrNotYetAvailable,
    parser: onDeviceParserNotYetAvailable,
    api: apiClientNotYetAvailable,
  });
}

export function CollectionProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
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

/** The signed-in Account's Collection, or null while it is still opening. */
export function useCollection(): Collection | null {
  return use(CollectionContext);
}
