import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { addStampPhotos, setPhotoLayout } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string }> };

/** Photos are creation-only. Existing owners get 400; foreign and missing stamps get the same 404. */
export const POST = route<Ctx>(async (req, { params }) => {
  await addStampPhotos(prisma, await getActor(req), (await params).id, []);
  throw new Error("Photo append must never succeed");
});

/** The scrapbook layout: `{ photos: [{ id, position?, x?, y?, rotation? }] }`. Owner only. */
export const PATCH = route<Ctx>(async (req, { params }) => ok(await setPhotoLayout(prisma, await getActor(req), (await params).id, await readJson(req))));
