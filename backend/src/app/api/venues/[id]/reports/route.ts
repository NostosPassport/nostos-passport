import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { reportInputSchema, submitReport } from "@/server/services/reports";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const report = await submitReport(prisma, await getActor(req), id, await parseJson(req, reportInputSchema));
  return ok({ report: { id: report.id, type: report.type, createdAt: report.createdAt } }, 201);
});
