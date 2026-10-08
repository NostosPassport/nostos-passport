import type { User } from "@prisma/client";

export function isIosClient(req: Request) {
  return req.headers.get("x-client")?.trim().toLowerCase() === "ios";
}

export function publicUser(u: Pick<User, "id" | "handle" | "displayName">) {
  return { id: u.id, handle: u.handle, displayName: u.displayName };
}
