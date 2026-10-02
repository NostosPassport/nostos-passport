import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/server/current", () => ({ getCurrentActor: () => { throw new Error("Actor lookup should be unreachable"); } }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import ModPage from "@/app/mod/page";
import AdminPage from "@/app/admin/page";
afterEach(() => vi.unstubAllEnvs());

it.each([["moderation", ModPage], ["admin", AdminPage]] as const)("personal-mode %s page returns a native 404 before authentication or database access", async (_name, page) => {
  vi.stubEnv("SOCIAL_ENABLED", "0");
  await expect(page()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
});
