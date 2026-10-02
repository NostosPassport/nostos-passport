import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, readJson, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { addStampPhotos, MAX_STAMP_PHOTOS, setPhotoLayout } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string }> };

/** Add photos (multipart `photos`, repeated) to your own stamp, up to 6 in all. */
export const POST = route<Ctx>(async (req, { params }) => {
  const actor = requireSignedIn(await getActor(req));
  const declared = Number(req.headers.get("content-length"));
  if (!req.headers.get("content-length")) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES * MAX_STAMP_PHOTOS + 256 * 1024) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected multipart/form-data");
  }
  const files = form.getAll("photos");
  if (files.some((f) => !(f instanceof Blob))) throw badRequest("photos must be files");
  const buffers = await Promise.all((files as Blob[]).map(async (f) => Buffer.from(await f.arrayBuffer())));
  return ok({ stamp: (await addStampPhotos(prisma, actor, (await params).id, buffers)).stamp });
});

/** The scrapbook layout: `{ photos: [{ id, position?, x?, y?, rotation? }] }`. Owner only. */
export const PATCH = route<Ctx>(async (req, { params }) => ok(await setPhotoLayout(prisma, await getActor(req), (await params).id, await readJson(req))));
