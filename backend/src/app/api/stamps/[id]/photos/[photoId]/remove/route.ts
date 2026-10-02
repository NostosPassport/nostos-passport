import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { removeStampPhoto } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/** Remove one photo from your stamp: hidden for good, never deleted. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id, photoId } = await params;
  return ok(await removeStampPhoto(prisma, await getActor(req), id, photoId));
});
