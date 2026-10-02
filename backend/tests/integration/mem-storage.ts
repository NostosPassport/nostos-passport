import { LocalDiskStorage, setStorageForTests, type BlobStorage } from "@/lib/storage";

/** In-memory BlobStorage for tests; signs URLs exactly like the local driver. */
export function installMemoryStorage() {
  const mem = new Map<string, Buffer>();
  const signer = new LocalDiskStorage("/nonexistent");
  const storage: BlobStorage = {
    put: async (k, d) => void mem.set(k, d),
    get: async (k) => mem.get(k) ?? null,
    delete: async (k) => void mem.delete(k),
    signedUrl: (k, now) => signer.signedUrl(k, now),
  };
  setStorageForTests(storage);
  return mem;
}
