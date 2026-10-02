import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { badRequest, ServiceError } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { assertOwnsVenue } from "@/server/permissions";
import { setOfficialPhoto } from "@/server/services/owner";
import { uploadUrl } from "@/server/services/venues";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = assertOwnsVenue(await getActor(req), id); // authorize before reading the body
  const len = req.headers.get("content-length");
  if (!len) throw new ServiceError(411, "length_required", "Content-Length is required for uploads");
  if (!(Number(len) <= MAX_UPLOAD_BYTES + 64 * 1024)) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob)) throw badRequest("Attach a photo");
  const venue = await setOfficialPhoto(prisma, actor, id, Buffer.from(await file.arrayBuffer()));
  return ok({ officialPhotoUrl: venue.officialPhotoKey ? await uploadUrl(venue.officialPhotoKey) : null });
});
