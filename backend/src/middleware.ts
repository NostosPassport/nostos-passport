import { NextResponse, type NextRequest } from "next/server";

/** Dev-only pages (seeded-account login) return a hard 404 outside development. */
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" && req.nextUrl.pathname.startsWith("/dev")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dev/:path*"] };
