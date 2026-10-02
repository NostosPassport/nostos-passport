import { resolveBaseUrl, resolveMediaUrl } from "../base-url";

describe("resolveBaseUrl", () => {
  it("prefers EXPO_PUBLIC_API_URL and trims trailing slashes", () => {
    expect(resolveBaseUrl("https://preview.nostos.app/", "192.168.1.20:8081", true)).toBe("https://preview.nostos.app");
  });
  it("uses the Metro host on the LAN in development", () => {
    expect(resolveBaseUrl(undefined, "192.168.1.20:8081", true)).toBe("http://192.168.1.20:3000");
    expect(resolveBaseUrl("", "192.168.1.20:8081/--/", true)).toBe("http://192.168.1.20:3000");
  });
  it("refuses to guess in release builds", () => {
    expect(() => resolveBaseUrl(undefined, undefined, false)).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});

describe("resolveMediaUrl", () => {
  it("resolves local-storage paths against the API host (development)", () => {
    expect(resolveMediaUrl("http://192.168.1.20:3000", "/api/uploads/p/abc.jpg?exp=1&sig=x")).toBe("http://192.168.1.20:3000/api/uploads/p/abc.jpg?exp=1&sig=x");
  });
  it("leaves protocol-relative URLs alone", () => {
    expect(resolveMediaUrl("https://preview.nostos.app", "//cdn.example/p.jpg")).toBe("//cdn.example/p.jpg");
  });
  it("leaves signed R2 URLs alone", () => {
    const r2 = "https://acct.r2.cloudflarestorage.com/nostos-photos-preview/p/abc.jpg?X-Amz-Signature=1";
    expect(resolveMediaUrl("https://preview.nostos.app", r2)).toBe(r2);
  });
});
