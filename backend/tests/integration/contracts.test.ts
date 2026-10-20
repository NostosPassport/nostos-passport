import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";

type Contract = ZodTypeAny | "binary";

const REGISTRY = new Map<string, Contract>([
  ["POST /api/auth/login/start", C.EmailChallengeResponse],
  ["POST /api/auth/login", C.TokenResponse],
  ["POST /api/auth/signup/start", C.EmailChallengeResponse],
  ["POST /api/auth/signup", C.TokenResponse],
  ["POST /api/auth/logout", C.OkResponse],
  ["POST /api/auth/logout-all", C.LogoutAllResponse],
  ["GET /api/me", C.MeResponse],
  ["POST /api/me/terms", C.AcceptTermsResponse],
  ["POST /api/me/email/start", C.EmailChallengeResponse],
  ["PATCH /api/me/email", C.EmailChangeResponse],
  ["POST /api/me/delete/start", C.EmailChallengeResponse],
  ["POST /api/me/delete", C.DeleteAccountResponse],
  ["GET /api/me/pins", C.PinsResponse],
  ["PUT /api/me/pins", C.PinsResponse],
  ["GET /api/me/profile", C.ProfileSettingsResponse],
  ["PATCH /api/me/profile", C.ProfileSettingsResponse],
  ["POST /api/me/avatar", C.AvatarResponse],
  ["DELETE /api/me/avatar", C.AvatarResponse],
  ["GET /api/places", C.PlacesResponse],
  ["GET /api/places/[id]", C.PlaceResponse],
  ["GET /api/places/nearby", C.NearbyPlacesResponse],
  ["GET /api/places/[id]/mine", C.MyPlacePageResponse],
  ["POST /api/places/[id]/stamps", C.CreateStampResponse],
  ["GET /api/stamps/[id]", C.StampResponse],
  ["PATCH /api/stamps/[id]", C.StampResponse],
  ["POST /api/stamps/[id]/photos", C.ErrorResponse],
  ["PATCH /api/stamps/[id]/photos", C.StampResponse],
  ["POST /api/stamps/[id]/photos/[photoId]/remove", C.StampResponse],
  ["POST /api/stamps/[id]/remove", C.RemoveStampResponse],
  ["GET /api/songs/search", C.SongSearchResponse],
  ["GET /api/users/[handle]/stamps", C.UserStampsResponse],
  ["GET /api/users/[handle]/places", C.UserPlacesResponse],
  ["GET /api/health", C.HealthResponse],
  ["GET /api/cron/maintenance", C.CronResponse],
  ["POST /api/cron/maintenance", C.CronResponse],
  ["GET /api/uploads/[...key]", "binary"],
]);

function discoverRoutes(root: string) {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== "route.ts") continue;
      const source = readFileSync(full, "utf8");
      const relative = path.relative(root, dir).split(path.sep).join("/");
      const route = `/api/${relative}`;
      for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)) found.push(`${match[1]} ${route}`);
    }
  };
  walk(root);
  return found.sort();
}

describe("API contract registry", () => {
  it("registers every current API route method and no removed route", () => {
    const root = path.resolve(process.cwd(), "src/app/api");
    expect(discoverRoutes(root)).toEqual([...REGISTRY.keys()].sort());
  });

  it("contains only current contract schemas", () => {
    for (const contract of REGISTRY.values()) {
      if (contract === "binary") continue;
      expect(typeof contract.safeParse).toBe("function");
    }
  });
});