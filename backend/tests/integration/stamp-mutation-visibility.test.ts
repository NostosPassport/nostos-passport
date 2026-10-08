import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import * as stampRoute from "@/app/api/stamps/[id]/route";
import * as removeRoute from "@/app/api/stamps/[id]/remove/route";
import * as photosRoute from "@/app/api/stamps/[id]/photos/route";
import * as photoRemoveRoute from "@/app/api/stamps/[id]/photos/[photoId]/remove/route";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

installMemoryStorage();

describe("stamp mutation visibility", () => {
  it("returns indistinguishable 404 responses for foreign, removed and missing stamps", async () => {
    const author = await makeActor();
    const foreign = await makeStamp(author, (await makeVenue()).id);
    const removed = await makeStamp(author, (await makeVenue()).id);
    await prisma.photo.update({ where: { id: removed.id }, data: { removedAt: new Date() } });

    const viewer = await makeActor();
    const token = (await createSession(prisma, viewer.userId, { client: "IOS" })).token;

    for (const mutation of ["edit", "remove", "append", "layout", "photo-remove"] as const) {
      const responses = [];
      for (const id of ["missing", foreign.id, removed.id]) {
        const headers: Record<string, string> = { authorization: `Bearer ${token}` };
        let body: BodyInit | undefined;
        if (mutation === "append") {
          const form = new FormData();
          form.append("photos", new Blob([new Uint8Array(pngBytes())], { type: "image/png" }), "test.png");
          body = form;
          headers["content-length"] = "1024";
        } else if (mutation === "edit" || mutation === "layout") {
          headers["content-type"] = "application/json";
          body = JSON.stringify(mutation === "edit" ? { caption: "edit" } : { photos: [{ id: foreign.photos[0]!.id, x: 0.2 }] });
        }

        const req = new Request("http://localhost/api/stamps/x", {
          method: mutation === "edit" || mutation === "layout" ? "PATCH" : "POST",
          headers,
          body,
        });
        const ctx = { params: Promise.resolve({ id, photoId: foreign.photos[0]!.id }) };
        const res =
          mutation === "edit"
            ? await stampRoute.PATCH(req, ctx)
            : mutation === "remove"
              ? await removeRoute.POST(req, ctx)
              : mutation === "append"
                ? await photosRoute.POST(req, ctx)
                : mutation === "layout"
                  ? await photosRoute.PATCH(req, ctx)
                  : await photoRemoveRoute.POST(req, ctx);
        responses.push({ status: res.status, body: await res.text() });
      }

      expect(responses[0]!.status, mutation).toBe(404);
      for (const response of responses.slice(1)) expect(response, mutation).toEqual(responses[0]);
    }
  });
});
