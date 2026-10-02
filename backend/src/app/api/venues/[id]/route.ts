import { prisma } from "@/lib/db";
import { notFound } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { getVenuePage } from "@/server/services/venues";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** The venue screen: official panel, live panel and the viewer's own state. `id` may be the venue id or its slug. */
export const GET = route<Ctx>(async (req, { params }) => {
  const key = (await params).id;
  const venue = await prisma.venue.findFirst({ where: { OR: [{ id: key }, { slug: key }] }, select: { slug: true } });
  if (!venue) throw notFound("Venue not found");
  return ok(await getVenuePage(prisma, venue.slug, await getActor(req)));
});
