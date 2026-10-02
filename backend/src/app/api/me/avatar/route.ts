import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { removeAvatar, setAvatar } from "@/server/services/people";

/** Profile photo upload (multipart `photo`). Authenticated and size-checked before the body is read. */
export const POST = route(async (req) => {
  const actor = requireSignedIn(await getActor(req));
  const len = req.headers.get("content-length");
  if (!len) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  if (!(Number(len) <= MAX_UPLOAD_BYTES + 64 * 1024)) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob)) throw badRequest("Attach a photo");
  return ok(await setAvatar(prisma, actor, Buffer.from(await file.arrayBuffer())));
});

export const DELETE = route(async (req) => ok(await removeAvatar(prisma, await getActor(req))));
