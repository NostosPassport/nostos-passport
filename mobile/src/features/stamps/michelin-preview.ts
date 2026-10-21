import { api } from "@/api";
import { tokenStore } from "@/auth/token-store";

export type MichelinStars = 1 | 2 | 3;
export type MichelinPreview = { venueId: string; stars: MichelinStars | null; proof: string | null };

let selectedKey: string | null = null;
let selectedProof: string | null = null;

const validStars = (value: unknown): MichelinStars | null => value === 1 || value === 2 || value === 3 ? value : null;

export const michelinPreviewDraft = {
  select(key: string) {
    selectedKey = key;
    selectedProof = null;
  },
  resolve(key: string, preview: MichelinPreview) {
    if (selectedKey === key) selectedProof = preview.proof;
  },
  clear(key?: string) {
    if (key !== undefined && selectedKey !== key) return;
    selectedKey = null;
    selectedProof = null;
  },
  proof() {
    return selectedProof;
  },
};

export async function fetchMichelinPreview(placeId: string): Promise<MichelinPreview> {
  const token = tokenStore.current();
  const response = await fetch(`${api.baseUrl}/api/places/${encodeURIComponent(placeId)}/michelin`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Client": "ios",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`Michelin preview ${response.status}`);
  const value = await response.json() as { venueId?: unknown; stars?: unknown; proof?: unknown };
  if (typeof value.venueId !== "string") throw new Error("Invalid Michelin preview response");
  if (value.proof !== null && value.proof !== undefined && typeof value.proof !== "string") throw new Error("Invalid Michelin preview proof");
  return {
    venueId: value.venueId,
    stars: validStars(value.stars),
    proof: typeof value.proof === "string" ? value.proof : null,
  };
}
