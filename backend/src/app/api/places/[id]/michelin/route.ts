import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { previewMichelinForPlace } from "@/server/services/michelin";
import { getPlace } from "@/server/services/places";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await getActor(req);
  const place = await getPlace(prisma, (await params).id);
  return ok(await previewMichelinForPlace(prisma, place));
});
