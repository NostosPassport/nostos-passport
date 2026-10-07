import * as C from "./contracts";
import { api, ApiError } from "@/api";
import { tokenStore } from "@/auth/token-store";

export type EmailChallenge = {
  challengeId: string;
  expiresAt: string;
  resendAfterSeconds: number;
};

function challengeResponse(value: unknown): EmailChallenge {
  if (
    !value ||
    typeof value !== "object" ||
    !("challengeId" in value) ||
    typeof value.challengeId !== "string" ||
    !("expiresAt" in value) ||
    typeof value.expiresAt !== "string" ||
    !("resendAfterSeconds" in value) ||
    typeof value.resendAfterSeconds !== "number"
  ) {
    throw new ApiError(0, "bad_response", "Something went wrong on our end. Try again in a moment.");
  }
  return {
    challengeId: value.challengeId,
    expiresAt: value.expiresAt,
    resendAfterSeconds: value.resendAfterSeconds,
  };
}

async function post(
  path: string,
  body?: unknown,
  authenticated = false,
): Promise<unknown> {
  const token = authenticated ? tokenStore.current() : null;
  if (authenticated && !token) throw new ApiError(401, "unauthorized", "Sign in again to continue.");

  let response: Response;
  try {
    response = await fetch(`${api.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client": "ios",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "offline", "You're offline. Check your connection and try again.");
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const error = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : "bad_request";
    const message = json && typeof json === "object" && "message" in json && typeof json.message === "string" ? json.message : "Something went wrong. Try again.";
    if (response.status === 401 && error === "invalid_token" && token) tokenStore.invalidate(token);
    throw new ApiError(response.status, error, message);
  }

  return json;
}

async function patch(path: string, body: unknown): Promise<unknown> {
  const token = tokenStore.current();
  if (!token) throw new ApiError(401, "unauthorized", "Sign in again to continue.");

  let response: Response;
  try {
    response = await fetch(`${api.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client": "ios",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "offline", "You're offline. Check your connection and try again.");
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const error = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : "bad_request";
    const message = json && typeof json === "object" && "message" in json && typeof json.message === "string" ? json.message : "Something went wrong. Try again.";
    if (response.status === 401 && error === "invalid_token") tokenStore.invalidate(token);
    throw new ApiError(response.status, error, message);
  }

  return json;
}

function tokenResponse(value: unknown): C.TokenResponse {
  const parsed = C.TokenResponse.safeParse(value);
  if (!parsed.success) throw new ApiError(0, "bad_response", "Something went wrong on our end. Try again in a moment.");
  return parsed.data;
}

export async function startSignupEmail(email: string, birthdate: string): Promise<EmailChallenge> {
  return challengeResponse(await post("/api/auth/signup/start", { email: email.trim(), birthdate }));
}

export async function completeSignup(input: {
  challengeId: string;
  code: string;
  handle: string;
  displayName: string;
  acceptTerms: true;
}): Promise<C.TokenResponse> {
  return tokenResponse(await post("/api/auth/signup", input));
}

export async function startEmailSignIn(email: string): Promise<EmailChallenge> {
  return challengeResponse(await post("/api/auth/login/start", { email: email.trim() }));
}

export async function completeEmailSignIn(challengeId: string, code: string): Promise<C.TokenResponse> {
  return tokenResponse(await post("/api/auth/login", { challengeId, code }));
}

export async function startAccountEmailChange(email: string): Promise<EmailChallenge> {
  return challengeResponse(await post("/api/me/email/start", { email: email.trim() }, true));
}

export async function completeAccountEmailChange(challengeId: string, code: string): Promise<string> {
  const result = await patch("/api/me/email", { challengeId, code });
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true || !("email" in result) || typeof result.email !== "string") {
    throw new ApiError(0, "bad_response", "Something went wrong on our end. Try again in a moment.");
  }
  return result.email;
}

export async function startDeleteAccountVerification(): Promise<EmailChallenge> {
  return challengeResponse(await post("/api/me/delete/start", {}, true));
}

export async function deleteAccountWithCode(challengeId: string, code: string): Promise<{ deleted: true }> {
  const result = await post("/api/me/delete", { challengeId, code }, true);
  if (!result || typeof result !== "object" || !("deleted" in result) || result.deleted !== true) {
    throw new ApiError(0, "bad_response", "Something went wrong on our end. Try again in a moment.");
  }
  return { deleted: true };
}
