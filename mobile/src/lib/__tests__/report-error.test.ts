import * as fs from "node:fs";

import { ApiError } from "@/api/client";
import { _resetErrorReporting, initErrorReporting, isReportable, reportError, scrub, sentryDsn } from "../report-error";

const DSN = "https://abc123@o0.ingest.sentry.io/1";
const fake = () => ({ init: jest.fn(), captureException: jest.fn() });

beforeEach(() => {
  _resetErrorReporting();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("Sentry is off by default", () => {
  it("needs the flag AND an https DSN", () => {
    expect(sentryDsn({})).toBeNull();
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_DSN: DSN })).toBeNull();
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_ENABLED: "1" })).toBeNull();
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_ENABLED: "true", EXPO_PUBLIC_SENTRY_DSN: DSN })).toBeNull();
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_ENABLED: "1", EXPO_PUBLIC_SENTRY_DSN: "http://insecure/1" })).toBeNull();
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_ENABLED: "1", EXPO_PUBLIC_SENTRY_DSN: DSN })).toBe(DSN);
  });

  it("does not even load the SDK when off, and reporting is a no-op", () => {
    const load = jest.fn();
    expect(initErrorReporting({}, load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(() => reportError(new Error("boom"))).not.toThrow();
  });

  it("no DSN is committed in the app config or the environment files", () => {
    for (const f of ["app.json", "eas.json", "package.json"]) expect(fs.readFileSync(f, "utf8")).not.toMatch(/ingest\.sentry\.io|sentry\.io\/\d/);
    expect(fs.readFileSync("app.json", "utf8")).not.toMatch(/SENTRY/);
  });
});

describe("when the build turns it on", () => {
  const env = { EXPO_PUBLIC_SENTRY_ENABLED: "1", EXPO_PUBLIC_SENTRY_DSN: DSN };

  it("initializes without personal data and with a scrubber", () => {
    const s = fake();
    expect(initErrorReporting(env, () => s)).toBe(true);
    const opts = s.init.mock.calls[0][0];
    expect(opts).toMatchObject({ dsn: DSN, sendDefaultPii: false, tracesSampleRate: 0 });
    expect(opts.beforeSend).toBe(scrub);
  });

  it("reports bugs and contract drift, not expected 4xx answers or being offline", () => {
    const s = fake();
    initErrorReporting(env, () => s);
    reportError(new Error("unexpected"));
    reportError(new ApiError(0, "bad_response", "x"));
    reportError(new ApiError(500, "bad_response", "x"));
    reportError(new ApiError(403, "forbidden", "You need to be within 100 m"));
    reportError(new ApiError(401, "invalid_credentials", "Wrong email or password"));
    reportError(new ApiError(0, "offline", "You're offline."));
    expect(s.captureException).toHaveBeenCalledTimes(3);
    expect(isReportable(new ApiError(404, "not_found", "x"))).toBe(false);
  });

  it("scrub removes the user, the request, breadcrumbs and the server name", () => {
    const event = { message: "m", user: { id: "u1", ip_address: "1.2.3.4" }, request: { url: "https://x/api/users/sam" }, breadcrumbs: [{ message: "GET /api/users/sam" }], server_name: "iphone", exception: { values: [] } };
    expect(scrub(event)).toEqual({ message: "m", exception: { values: [] } });
  });

  it("a broken SDK never breaks the app", () => {
    expect(initErrorReporting(env, () => { throw new Error("native module missing"); })).toBe(false);
    const s = fake();
    s.captureException.mockImplementation(() => { throw new Error("sdk crashed"); });
    initErrorReporting(env, () => s);
    expect(() => reportError(new Error("x"))).not.toThrow();
  });
});
