import { describe, expect, it } from "vitest";
import { openCollection } from "../src/collection";
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
});
