import { describe, expect, it } from "vitest";

import { CollectionCreateRequest, CollectionUpdateRequest, StampCollectionsRequest } from "@/contracts/collections";

describe("collection contracts", () => {
  it("accepts a named collection with a curated cover color", () => {
    expect(CollectionCreateRequest.parse({ name: "Date Nights", color: "blue", stampIds: ["stamp-1"] })).toEqual({ name: "Date Nights", color: "blue", stampIds: ["stamp-1"] });
  });

  it("enforces the 32 character collection name limit", () => {
    expect(() => CollectionCreateRequest.parse({ name: "x".repeat(33), color: "navy", stampIds: [] })).toThrow();
  });

  it("rejects colors outside the curated passport palette", () => {
    expect(() => CollectionCreateRequest.parse({ name: "Favorites", color: "orange", stampIds: [] })).toThrow();
  });

  it("allows membership to be cleared", () => {
    expect(StampCollectionsRequest.parse({ collectionIds: [] })).toEqual({ collectionIds: [] });
  });

  it("requires an actual edit", () => {
    expect(() => CollectionUpdateRequest.parse({})).toThrow();
  });
});
