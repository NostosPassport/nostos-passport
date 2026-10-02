import { containsObjectionable } from "@/lib/content-filter";

/** Errors thrown by the service layer. Route handlers map `status` straight to the HTTP response. */
export class ServiceError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 411 | 413 | 415 | 422 | 429,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const badRequest = (message: string, code = "bad_request") => new ServiceError(400, code, message);
export const unauthorized = (message = "Sign in required") => new ServiceError(401, "unauthorized", message);
export const forbidden = (message = "Not allowed") => new ServiceError(403, "forbidden", message);
export const notFound = (message = "Not found") => new ServiceError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new ServiceError(409, code, message);
export const tooMany = (message: string) => new ServiceError(429, "rate_limited", message);

/**
 * Rejects user-visible text containing slurs or explicit terms (App Store Guideline 1.2).
 * `fields` maps a human label ("comment", "caption", "handle") to its text.
 */
export function assertCleanText(fields: Record<string, string | null | undefined>) {
  for (const [label, text] of Object.entries(fields)) {
    if (containsObjectionable(text)) {
      throw new ServiceError(400, "objectionable_content", `Your ${label} contains language we don't allow. Please rephrase it.`);
    }
  }
}
