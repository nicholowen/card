import { describe, expect, it } from "vitest";
import { CardCopyNotFound, EmptyCard, openCollection } from "../src/collection";
import { createTestCollection } from "./harness";

describe("Collection", () => {
  it("is empty for a new Holder", async () => {
    const { collection } = await createTestCollection();

    expect(await collection.list()).toEqual([]);
  });

  it("opens again on an existing device database, as on the next app launch", async () => {
    const { deps } = await createTestCollection();

    const reopened = await openCollection(deps);

    expect(await reopened.list()).toEqual([]);
  });

  describe("entering a card by hand", () => {
    it("adds it to the Collection", async () => {
      const { collection } = await createTestCollection();

      const card = await collection.addManual({ name: "Aroha Ngata", jobTitle: "CTO", company: "Kōwhai Labs" });

      expect(await collection.list()).toEqual([
        { id: card.id, name: "Aroha Ngata", jobTitle: "CTO", company: "Kōwhai Labs", createdAt: card.createdAt },
      ]);
    });

    it("keeps every field, and the card is still there on the next app launch", async () => {
      const { collection, deps } = await createTestCollection();
      const fields = {
        name: "Aroha Ngata",
        jobTitle: "CTO",
        company: "Kōwhai Labs",
        email: "aroha@kowhai.example",
        phone: "+64 21 555 0199",
        website: "kowhai.example",
        address: "12 Cuba Street, Wellington",
        socials: [{ network: "LinkedIn", handle: "arohangata" }],
      };
      const { id } = await collection.addManual(fields);

      const reopened = await openCollection(deps);

      expect(await reopened.get(id)).toEqual({
        id,
        source: "manual",
        fields,
        createdAt: "2026-10-19T09:00:00.000Z",
        updatedAt: "2026-10-19T09:00:00.000Z",
      });
    });
  });

  describe("what the Holder typed", () => {
    it("is trimmed, and blank fields and social handles are left out", async () => {
      const { collection } = await createTestCollection();

      const { id } = await collection.addManual({
        name: "  Aroha Ngata ",
        jobTitle: "",
        company: "   ",
        email: " aroha@kowhai.example",
        socials: [
          { network: "LinkedIn", handle: " arohangata " },
          { network: "Instagram", handle: "  " },
        ],
      });

      expect((await collection.get(id))?.fields).toEqual({
        name: "Aroha Ngata",
        email: "aroha@kowhai.example",
        socials: [{ network: "LinkedIn", handle: "arohangata" }],
      });
    });

    it("must contain at least one detail", async () => {
      const { collection } = await createTestCollection();
      const { id } = await collection.addManual({ name: "Aroha Ngata" });

      await expect(collection.addManual({ name: " ", socials: [] })).rejects.toThrow(EmptyCard);
      await expect(collection.editMyVersion(id, { company: "" })).rejects.toThrow(EmptyCard);
      expect(await collection.list()).toHaveLength(1);
      expect((await collection.get(id))?.fields).toEqual({ name: "Aroha Ngata" });
    });
  });

  describe("editing My Version", () => {
    it("replaces the card's fields at any time, and the Collection shows the change", async () => {
      const { collection, clock } = await createTestCollection();
      const { id } = await collection.addManual({ name: "Aroha Ngata", company: "Kowhai Labs", phone: "021 555 0199" });
      clock.advance(60 * 24 * 30);

      await collection.editMyVersion(id, { name: "Aroha Ngata", jobTitle: "CTO", company: "Kōwhai Labs" });

      expect(await collection.get(id)).toEqual({
        id,
        source: "manual",
        fields: { name: "Aroha Ngata", jobTitle: "CTO", company: "Kōwhai Labs" },
        createdAt: "2026-10-19T09:00:00.000Z",
        updatedAt: "2026-11-18T09:00:00.000Z",
      });
      expect(await collection.list()).toMatchObject([{ id, jobTitle: "CTO", company: "Kōwhai Labs" }]);
    });
  });

  describe("deleting a Card Copy", () => {
    it("removes it from the Collection", async () => {
      const { collection } = await createTestCollection();
      const kept = await collection.addManual({ name: "Mere Tawhiri" });
      const deleted = await collection.addManual({ name: "Aroha Ngata" });

      await collection.delete(deleted.id);

      expect(await collection.list()).toMatchObject([{ id: kept.id }]);
      expect(await collection.get(deleted.id)).toBeNull();
    });

    it("keeps the deletion as an Unsynced change, so it reaches the server on the next sync", async () => {
      const { collection, clock } = await createTestCollection();
      const { id } = await collection.addManual({ name: "Aroha Ngata" });
      clock.advance(5);

      await collection.delete(id);

      expect(await collection.unsyncedChanges()).toEqual([
        { id, updatedAt: "2026-10-19T09:05:00.000Z", deletedAt: "2026-10-19T09:05:00.000Z" },
      ]);
    });

    it("can no longer be edited", async () => {
      const { collection } = await createTestCollection();
      const { id } = await collection.addManual({ name: "Aroha Ngata" });
      await collection.delete(id);

      await expect(collection.editMyVersion(id, { name: "Aroha" })).rejects.toThrow(CardCopyNotFound);
    });
  });
});
