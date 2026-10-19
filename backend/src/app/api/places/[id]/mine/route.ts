import { prisma } from "@/lib/db";
import { ok, getActor, route } from "@/server/http";
import { getPlace } from "@/server/services/places";
import { getMyPlacePage } from "@/server/services/stamps";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Your own page for a place. Google place_ids are get-or-created before loading visit history. */
export const GET = route<Ctx>(async (req, { params }) => {
  const q = new URL(req.url).searchParams;
  const lat = q.get("lat"), lng = q.get("lng");
  const pos = lat !== null && lng !== null ? { lat: Number(lat), lng: Number(lng) } : null;
  const actor = await getActor(req);
  const place = await getPlace(prisma, (await params).id);
  const page = await getMyPlacePage(prisma, actor, place.id, pos);
  return ok({ ...page, place });
});
