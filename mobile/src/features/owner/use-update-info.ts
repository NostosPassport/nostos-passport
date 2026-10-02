import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api";
import type { OfficialInfoRequest } from "@/api/contracts";
import { invalidateVenue, qk } from "@/api/queries";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";

/** PATCH official info (only changed fields), then refresh the dashboard and the public page. */
export function useUpdateInfo(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OfficialInfoRequest) => api.owner.updateInfo(venueId, body),
    onSuccess: () => {
      haptics.success();
      toast.show("Saved.");
      void queryClient.invalidateQueries({ queryKey: qk.ownerDashboard(venueId) });
      void invalidateVenue(queryClient, venueId);
    },
    onError: () => haptics.warning(),
  });
}

export type DetailValues = { name: string; address: string; officialCover: string; dressCode: string };

/** The PATCH body: only fields that changed (API.md: send only changed fields). */
export function changedFields(initial: DetailValues, values: DetailValues): OfficialInfoRequest {
  const out: OfficialInfoRequest = {};
  for (const k of Object.keys(values) as (keyof DetailValues)[]) {
    if (values[k].trim() !== initial[k].trim()) out[k] = values[k].trim();
  }
  return out;
}
