import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import * as stampRoute from "@/app/api/stamps/[id]/route";
import * as removeRoute from "@/app/api/stamps/[id]/remove/route";
import * as photosRoute from "@/app/api/stamps/[id]/photos/route";
import * as photoRemoveRoute from "@/app/api/stamps/[id]/photos/[photoId]/remove/route";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

installMemoryStorage();
afterEach(() => vi.unstubAllEnvs());

describe("stamp mutation visibility", () => {
  it.each(["0", "1"])("social=%s: every mutation has identical status, body and headers for foreign live, hidden, removed and missing stamps", async (social) => {
    vi.stubEnv("SOCIAL_ENABLED", social);
    const author = await makeActor({ isPrivate: false });
    const live = await makeStamp(author, (await makeVenue()).id);
    const hidden = await makeStamp(author, (await makeVenue()).id);
    const removed = await makeStamp(author, (await makeVenue()).id);
    await prisma.photo.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    await prisma.photo.update({ where: { id: removed.id }, data: { removedAt: new Date() } });
    for (const role of ["USER", "MODERATOR", "ADMIN"] as const) {
      const viewer = await makeActor({ role });
      const token = (await createSession(prisma, viewer.userId, { client: "IOS" })).token;
      for (const mutation of ["edit", "remove", "append", "layout", "photo-remove"] as const) {
        const responses = [];
        for (const id of ["missing", live.id, hidden.id, removed.id]) {
          const headers: Record<string, string> = { authorization: `Bearer ${token}` };
          let body: BodyInit | undefined;
          if (mutation === "append") {
            const form = new FormData();
            form.append("photos", new Blob([new Uint8Array(pngBytes())], { type: "image/png" }), "test.png");
            body = form;
            headers["content-length"] = "1024";
          } else if (mutation === "edit" || mutation === "layout") {
            headers["content-type"] = "application/json";
            body = JSON.stringify(mutation === "edit" ? { caption: "edit" } : { photos: [{ id: live.photos[0]!.id, x: 0.2 }] });
          }
          const req = new Request("http://localhost/api/stamps/x", { method: mutation === "edit" || mutation === "layout" ? "PATCH" : "POST", headers, body });
          const ctx = { params: Promise.resolve({ id, photoId: live.photos[0]!.id }) };
          const res = mutation === "edit" ? await stampRoute.PATCH(req, ctx) : mutation === "remove" ? await removeRoute.POST(req, ctx) : mutation === "append" ? await photosRoute.POST(req, ctx) : mutation === "layout" ? await photosRoute.PATCH(req, ctx) : await photoRemoveRoute.POST(req, ctx);
          responses.push({ status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers) });
        }
        expect(responses[0]!.status, `${role} ${mutation}`).toBe(404);
        for (const response of responses.slice(1)) expect(response, `${role} ${mutation}`).toEqual(responses[0]);
      }
    }
  });
});
