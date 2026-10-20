import { beforeEach, describe, expect, it } from "vitest";

import { collectionShareIdFromToken, collectionShareToken, publicCollectionShareUrl } from "@/server/services/collection-sharing";

beforeEach(() => {
  process.env.SHARE_TOKEN_SECRET = "unit-test-collection-share-secret-1234567890";
  process.env.APP_ENV = "development";
  delete process.env.PUBLIC_WEB_URL;
});

describe("collection share tokens", () => {
  it("round-trips a signed share id without storing a bearer token", () => {
    const token = collectionShareToken("cm1234567890abcdef");
    expect(collectionShareIdFromToken(token)).toBe("cm1234567890abcdef");
  });

  it("rejects a tampered token", () => {
    const token = collectionShareToken("cm1234567890abcdef");
    const last = token.endsWith("A") ? "B" : "A";
    expect(collectionShareIdFromToken(`${token.slice(0, -1)}${last}`)).toBeNull();
  });

  it("builds local shared collection URLs by default", () => {
    expect(publicCollectionShareUrl("cm1234567890abcdef")).toMatch(/^http:\/\/localhost:3001\/c\/cs1\./);
  });
});
