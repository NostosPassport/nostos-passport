import type { User } from "@prisma/client";

/** Native clients identify themselves with `X-Client: ios` and get a bearer token in the body, never a cookie. */
export function isIosClient(req: Request) {
  return req.headers.get("x-client")?.trim().toLowerCase() === "ios";
}

export function publicUser(u: Pick<User, "id" | "handle" | "displayName" | "role">) {
  return { id: u.id, handle: u.handle, displayName: u.displayName, role: u.role };
}
