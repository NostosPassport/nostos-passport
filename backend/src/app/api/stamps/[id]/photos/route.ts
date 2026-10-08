import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, readJson, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { addStampPhotos, MAX_STAMP_PHOTOS, setPhotoLayout } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string }> };

/** Append photos to an existing owner stamp. */
export const POST = route<Ctx>(async (req, { params }) => {
  const actor = requireSignedIn(await getActor(req));
  const lengthHeader = req.headers.get("content-length");
  if (!lengthHeader) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  const declared = Number(lengthHeader);
  if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES * MAX_STAMP_PHOTOS + 128 * 1024) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  let form: FormData;
  try { form = await req.formData(); } catch { throw badRequest("Expected multipart/form-data"); }
  const files = [...form.getAll("photos"), ...form.getAll("photo")];
  if (!files.length || files.some((f) => !(f instanceof Blob))) throw badRequest("photos must be files");
  return ok(await addStampPhotos(prisma, actor, (await params).id, await Promise.all((files as Blob[]).map(async (f) => Buffer.from(await f.arrayBuffer())))));
});

/** The scrapbook layout: `{ photos: [{ id, position?, x?, y?, rotation? }] }`. Owner only. */
export const PATCH = route<Ctx>(async (req, { params }) => ok(await setPhotoLayout(prisma, await getActor(req), (await params).id, await readJson(req))));
