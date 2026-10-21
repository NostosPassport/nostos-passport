import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { cacheMichelinPreviewForStamp } from "@/server/services/michelin";
import { ensureGooglePriceForStamp, getPlace } from "@/server/services/places";
import { createStamp, getStamp, MAX_STAMP_PHOTOS } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string }> };
const field = (form: FormData, name: string) => { const v = form.get(name); return typeof v === "string" ? v : undefined; };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = requireSignedIn(await getActor(req));
  const lengthHeader = req.headers.get("content-length");
  if (!lengthHeader) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  const declared = Number(lengthHeader);
  if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES * MAX_STAMP_PHOTOS + 256 * 1024) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  let form: FormData;
  try { form = await req.formData(); } catch { throw badRequest("Expected multipart/form-data"); }
  const files = [...form.getAll("photos"), ...form.getAll("photo")];
  if (files.some((f) => !(f instanceof Blob))) throw badRequest("photos must be files");
  const collectionValues = form.getAll("collectionId");
  if (collectionValues.some((value) => typeof value !== "string")) throw badRequest("collectionId must be text");
  const collectionIds = collectionValues as string[];
  const meta: Record<string, string> = {};
  for (const name of ["caption", "mode", "visitedAt", "lat", "lng", "rating", "songTitle", "songArtist", "songArtUrl", "songSourceId"]) {
    const v = field(form, name); if (v !== undefined) meta[name] = v;
  }
  const place = await getPlace(prisma, id);
  await ensureGooglePriceForStamp(prisma, place);
  const stamp = await createStamp(prisma, actor, place.id, {
    photos: await Promise.all((files as Blob[]).map(async (f) => Buffer.from(await f.arrayBuffer()))),
    meta,
    collectionIds,
  });
  await cacheMichelinPreviewForStamp(prisma, place, field(form, "michelinProof")).catch(() => undefined);
  return ok(await getStamp(prisma, actor, stamp.id), 201);
});
