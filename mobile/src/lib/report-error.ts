/**
 * The one place the app reports unexpected errors from. Off by default: nothing leaves the phone unless the build sets
 * EXPO_PUBLIC_SENTRY_ENABLED=1 and EXPO_PUBLIC_SENTRY_DSN to an https DSN. No DSN is committed anywhere.
 *
 * What is reported: the error, its stack, the app version and OS. What is not: no user, no email, no request, no
 * breadcrumbs (they hold API paths with handles), no IP address. Sentry is told not to attach personal data, and
 * `scrub` drops anything that slipped in. See OPEN-QUESTIONS.md L5 for the privacy-label question.
 */
import { ApiError } from "@/api/client";

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void;
};

export type SentryEnv = { EXPO_PUBLIC_SENTRY_ENABLED?: string; EXPO_PUBLIC_SENTRY_DSN?: string };

/** The DSN to use, or null when reporting is off (not enabled, or no https DSN set). */
export function sentryDsn(env: SentryEnv): string | null {
  if (env.EXPO_PUBLIC_SENTRY_ENABLED !== "1") return null;
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";
  return /^https:\/\/\S+$/.test(dsn) ? dsn : null;
}

/** Remove everything about the person and their requests from an event before it is sent. */
export function scrub<E extends Record<string, unknown>>(event: E): E {
  const out: Record<string, unknown> = { ...event };
  for (const key of ["user", "request", "breadcrumbs", "server_name"]) delete out[key];
  return out as E;
}

let client: SentryLike | null = null;

/** Start reporting if (and only if) the build turned it on. Safe to call more than once. Returns whether it is on. */
// The SDK is loaded lazily on purpose: when reporting is off, the module is never touched.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadSentry = (): SentryLike => require("@sentry/react-native") as SentryLike;

export function initErrorReporting(env: SentryEnv = process.env as SentryEnv, load: () => SentryLike = loadSentry): boolean {
  if (client) return true;
  const dsn = sentryDsn(env);
  if (!dsn) return false;
  try {
    const sentry = load();
    sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate: 0, attachScreenshot: false, enableAutoSessionTracking: false, beforeSend: scrub });
    client = sentry;
    return true;
  } catch {
    // A broken error reporter must never break the app.
    return false;
  }
}

/** Errors worth a person's attention: bugs and contract drift. Not a bad password, a 404, a geofence refusal or being offline. */
export function isReportable(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === "bad_response" || error.status >= 500;
  return true;
}

/** Report an unexpected error. Logs in development; sends only when reporting is on. Never throws. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.warn("[error]", error, context ?? "");
  if (!client || !isReportable(error)) return;
  try {
    client.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting is best effort.
  }
}

/** For tests: forget the client. */
export function _resetErrorReporting() {
  client = null;
}
