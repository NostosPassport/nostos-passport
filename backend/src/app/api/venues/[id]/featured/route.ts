import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { assertVenue, currentMonth, featuredMonth } from "@/server/services/gallery";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** One month's featured gallery (`?month=YYYY-MM`, default this month), newest night first, top 10 per night. */
export const GET = route<Ctx>(async (req, { params }) => {
  const venue = await assertVenue(prisma, (await params).id);
  const month = new URL(req.url).searchParams.get("month") ?? currentMonth(new Date());
  const { nights } = await featuredMonth(prisma, await getActor(req), venue.id, month);
  return ok({ month, nights });
});
