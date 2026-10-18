import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { CardCopy } from "../collection";
import { useCollection } from "./collection-context";

/**
 * One Card Copy from the Collection, reloaded whenever its screen comes into view.
 * `undefined` while loading, `null` if it doesn't exist or has been deleted.
 */
export function useCardCopy(id: string): CardCopy | null | undefined {
  const collection = useCollection();
  const [card, setCard] = useState<CardCopy | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      collection?.get(id).then(setCard);
    }, [collection, id]),
  );

  return card;
}
