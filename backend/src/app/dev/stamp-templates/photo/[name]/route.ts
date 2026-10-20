import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/** Development-only: serves the committed dev-fixtures/stamp-photos images to the stamp preview. Production returns 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV !== "development") return new NextResponse("Not found", { status: 404 });
  const { name } = await params;
  if (!/^[a-z0-9-]+$/.test(name)) return new NextResponse("Not found", { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "dev-fixtures", "stamp-photos", `${name}.jpg`));
    return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
