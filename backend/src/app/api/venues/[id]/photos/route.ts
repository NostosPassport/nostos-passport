import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { submitPhoto } from "@/server/services/photos";
import { uploadUrl } from "@/server/services/venues";
import { requireSignedIn } from "@/server/permissions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  // Authenticate and size-check BEFORE buffering the body: anonymous or oversized uploads never reach memory.
  const actor = requireSignedIn(await getActor(req));
  const lengthHeader = req.headers.get("content-length");
  if (!lengthHeader) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  const declared = Number(lengthHeader);
  if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected multipart/form-data");
  }
  const file = form.get("photo");
  if (!(file instanceof Blob)) throw badRequest("Attach a photo");
  const photo = await submitPhoto(prisma, actor, id, {
    bytes: Buffer.from(await file.arrayBuffer()),
    meta: {
      caption: form.get("caption") ?? "", lat: form.get("lat"), lng: form.get("lng"),
      // Optional: a rating makes it a post; `shared` defaults from the account's privacy.
      ...(form.get("rating") !== null ? { rating: form.get("rating") } : {}),
      ...(form.get("shared") !== null ? { shared: form.get("shared") } : {}),
    },
  });
  return ok(
    { photo: { id: photo.id, createdAt: photo.createdAt, url: await uploadUrl(photo.storageKey), caption: photo.caption, rating: photo.rating, shared: photo.shared } },
    201,
  );
});
