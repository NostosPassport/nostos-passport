import { getStorage, isValidKey, mimeForKey, verifyLocalSignature } from "@/lib/storage";
import { notFound } from "@/server/errors";
import { route } from "@/server/http";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * Serves images for the local storage driver only. Every request needs a valid, unexpired HMAC signature
 * (`?exp=&sig=`), which the service layer issues only for content the viewer may see. With R2 the API returns
 * presigned R2 URLs and this route is never used. Unsigned or expired requests get 404 so keys can't be probed.
 */
export const GET = route<Ctx>(async (req, { params }) => {
  const key = (await params).key.join("/");
  const url = new URL(req.url);
  if (!isValidKey(key) || !verifyLocalSignature(key, url.searchParams.get("exp"), url.searchParams.get("sig"))) throw notFound();
  const bytes = await getStorage().get(key).catch(() => null);
  if (!bytes) throw notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mimeForKey(key),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      "cache-control": "private, max-age=900",
    },
  });
});
