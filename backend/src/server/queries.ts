import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/** Per-request memoized lookups shared by layouts, metadata and pages. */
export const venueBySlug = cache((slug: string) => prisma.venue.findUnique({ where: { slug }, select: { id: true, name: true } }));
export const userByHandle = cache((handle: string) =>
  prisma.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, handle: true } }),
);
