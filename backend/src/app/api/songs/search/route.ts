import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { searchSongs } from "@/server/services/songs";

export const dynamic = "force-dynamic";

/** Song search for the composer: `?q=`. Metadata only. Proxied to Apple's iTunes Search API; rate limited; signed in only. */
export const GET = route(async (req) => ok(await searchSongs(prisma, await getActor(req), new URL(req.url).searchParams.get("q"))));
