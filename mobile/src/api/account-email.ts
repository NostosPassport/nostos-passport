import { api, ApiError } from "@/api";
import { tokenStore } from "@/auth/token-store";

export async function changeAccountEmail(email: string, password: string): Promise<void> {
  const token = tokenStore.current();
  if (!token) throw new ApiError(401, "unauthorized", "Sign in again to change your email.");

  let res: Response;
  try {
    res = await fetch(`${api.baseUrl}/api/me/email`, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Client": "ios", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    throw new ApiError(0, "offline", "You're offline. Check your connection and try again.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const error = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "bad_request";
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Couldn't change your email. Try again.";
    if (res.status === 401 && error === "invalid_token") tokenStore.invalidate(token);
    throw new ApiError(res.status, error, message);
  }

  if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
    throw new ApiError(0, "bad_response", "Something went wrong on our end. Try again in a moment.");
  }
}
