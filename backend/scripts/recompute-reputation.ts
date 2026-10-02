import { PrismaClient } from "@prisma/client";
import { recomputeAllReputations } from "../src/server/services/reputation";

const db = new PrismaClient();
const start = Date.now();
recomputeAllReputations(db)
  .then((r) => console.log(`[reputation] judged ${r.judged} reports, updated ${r.updated} users in ${Date.now() - start}ms`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
