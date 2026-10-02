import { api, ApiError } from "@/api";
import type { PhotoView } from "@/api/contracts";
import { uploadStore } from "../upload-store";
import { LIVE_WINDOW_MS, stillLive } from "../use-live-photos";

jest.mock("@/api", () => {
  const { ApiError } = jest.requireActual("@/api/client");
  return { api: { upload: jest.fn() }, ApiError, errorText: jest.requireActual("@/api/client").errorText };
});

const photo = (id: string, createdAt: string): PhotoView => ({ id, url: `https://x/${id}`, caption: "", createdAt, rating: null, likes: null, author: { kind: "user", handle: "maya", verified: false, regular: false }, mine: false });

describe("live photos", () => {
  const now = Date.parse("2026-09-24T03:00:00.000Z");
  it("drops photos once createdAt + 3 h passes on the server's clock", () => {
    const fresh = photo("a", new Date(now - LIVE_WINDOW_MS + 60_000).toISOString());
    const stale = photo("b", new Date(now - LIVE_WINDOW_MS - 1).toISOString());
    expect(stillLive([fresh, stale], now).map((p) => p.id)).toEqual(["a"]);
    expect(stillLive([fresh], now + 61_000)).toEqual([]);
  });
});

describe("upload store", () => {
  const input = { venueId: "v1", uri: "file:///p.jpg", caption: "Packed", coords: { lat: 40.72, lng: -73.98 } };
  const upload = api.upload as jest.Mock;

  afterEach(() => {
    for (const u of uploadStore.get()) uploadStore.remove(u.localId);
    upload.mockReset();
  });

  it("shows an optimistic tile with progress that becomes the real photo", async () => {
    let resolve!: (v: unknown) => void;
    upload.mockImplementation((_path: string, _schema: unknown, form: FormData, opts: { onProgress: (f: number) => void }) => {
      expect(form).toBeInstanceOf(FormData);
      opts.onProgress(0.4);
      return new Promise((r) => (resolve = r));
    });
    const onSuccess = jest.fn();
    const id = uploadStore.start(input, { onSuccess });
    expect(upload.mock.calls[0][0]).toBe("/api/venues/v1/photos");
    expect(uploadStore.get()[0]).toMatchObject({ localId: id, status: "uploading", progress: 0.4, uri: input.uri });

    resolve({ photo: { id: "p1", url: "https://cdn/p1", createdAt: "2026-09-24T03:00:00Z", caption: "Packed" } });
    await new Promise((r) => setTimeout(r, 0));
    expect(uploadStore.get()[0]).toMatchObject({ status: "done", result: { id: "p1", url: "https://cdn/p1" } });
    expect(onSuccess).toHaveBeenCalled();

    // Once the refetched page includes it, the optimistic copy goes away.
    uploadStore.settle("v1", new Set(["p1"]));
    expect(uploadStore.get()).toHaveLength(0);
  });

  it("keeps the server's geofence or cooldown sentence on a failed tile, and retries", async () => {
    upload.mockRejectedValueOnce(new ApiError(429, "rate_limited", "You already posted a photo here. Try again in 9 min."));
    const onError = jest.fn();
    const id = uploadStore.start(input, { onError });
    await new Promise((r) => setTimeout(r, 0));
    expect(uploadStore.get()[0]).toMatchObject({ status: "failed", error: "You already posted a photo here. Try again in 9 min." });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));

    upload.mockResolvedValueOnce({ photo: { id: "p2", url: "u", createdAt: "2026-09-24T03:00:00Z", caption: "" } });
    uploadStore.retry(id);
    await new Promise((r) => setTimeout(r, 0));
    expect(uploadStore.get()[0].status).toBe("done");
  });

  it("uses its own sentence for server errors", async () => {
    upload.mockRejectedValueOnce(new ApiError(502, "bad_response", "x"));
    uploadStore.start(input);
    await new Promise((r) => setTimeout(r, 0));
    expect(uploadStore.get()[0].error).toBe("Couldn't upload that photo. Try again.");
  });
});

describe("upload store hardening", () => {
  const input = { venueId: "v1", uri: "file:///p.jpg", caption: "", coords: { lat: 1, lng: 2 } };
  const upload = api.upload as jest.Mock;
  afterEach(() => {
    for (const u of uploadStore.get()) uploadStore.remove(u.localId);
    upload.mockReset();
  });

  it("never sends the same upload twice at once", async () => {
    upload.mockRejectedValueOnce(new ApiError(0, "offline", "x"));
    const id = uploadStore.start(input);
    await new Promise((r) => setTimeout(r, 0));
    upload.mockImplementation(() => new Promise(() => undefined));
    uploadStore.retry(id);
    uploadStore.retry(id);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("retries with the original callbacks", async () => {
    const onSuccess = jest.fn();
    upload.mockRejectedValueOnce(new ApiError(0, "offline", "x"));
    const id = uploadStore.start(input, { onSuccess });
    await new Promise((r) => setTimeout(r, 0));
    upload.mockResolvedValueOnce({ photo: { id: "p9", url: "u", createdAt: "2026-09-24T03:00:00Z", caption: "" } });
    uploadStore.retry(id);
    await new Promise((r) => setTimeout(r, 0));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
