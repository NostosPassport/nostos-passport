import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { endPromo, promoView } from "@/server/services/owner";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => ok({ promo: promoView(await endPromo(prisma, await getActor(req), (await params).id)) }));
