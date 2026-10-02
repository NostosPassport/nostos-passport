import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { searchUsers } from "@/server/services/people";

export const GET = socialRoute(async (req) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok({ users: await searchUsers(prisma, await getActor(req), q.slice(0, 50)) });
});
