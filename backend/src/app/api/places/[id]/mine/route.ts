import { prisma } from "@/lib/db";
import { ok, getActor, route } from "@/server/http";
import { getMyPlacePage } from "@/server/services/stamps";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Your own page for a place: your stamps there (stacked by night) and `inside`, whether `?lat=&lng=` is within its geofence. */
export const GET = route<Ctx>(async (req, { params }) => {
  const q = new URL(req.url).searchParams;
  const lat = q.get("lat"), lng = q.get("lng");
  const pos = lat !== null && lng !== null ? { lat: Number(lat), lng: Number(lng) } : null;
  return ok(await getMyPlacePage(prisma, await getActor(req), (await params).id, pos));
});
