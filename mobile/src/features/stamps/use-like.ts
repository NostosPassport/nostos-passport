import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { api, errorText } from "@/api";
import type { LikeSummary } from "@/api/contracts";
import { useAuth } from "@/auth/auth-context";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { patchStamp } from "./cache";

/** What a like or unlike does to a summary, before the server answers. */
export function toggledLikes(current: LikeSummary): LikeSummary {
  const like = !current.viewerLiked;
  return { viewerLiked: like, count: Math.max(0, current.count + (like ? 1 : -1)) };
}

/**
 * Like or unlike a stamp, optimistically, with a light haptic. Signed-out taps go to sign-in. A second tap while one is
 * in flight is ignored, so the count can't drift.
 */
export function useLike() {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const set = (stampId: string, likes: LikeSummary) => patchStamp(queryClient, stampId, (s) => ({ ...s, likes }));
  const mutation = useMutation({
    mutationFn: (v: { stampId: string; current: LikeSummary }) => api.stamps.like(v.stampId, !v.current.viewerLiked),
    onMutate: ({ stampId, current }) => {
      haptics.select();
      set(stampId, toggledLikes(current));
    },
    onSuccess: (res, { stampId }) => set(stampId, { count: res.count, viewerLiked: res.viewerLiked }),
    onError: (e, { stampId, current }) => {
      haptics.warning();
      set(stampId, current);
      toast.show(errorText(e, "Couldn't update that like. Try again."), "neutral");
    },
  });
  return {
    ...mutation,
    /** `current` is the summary the heart shows. `onlyLike` (double-tap) never unlikes. */
    toggle: (stampId: string, current: LikeSummary, onlyLike = false) => {
      if (status !== "signedIn") return router.push("/sign-in");
      if (onlyLike && current.viewerLiked) return haptics.select();
      if (mutation.isPending && mutation.variables?.stampId === stampId) return;
      mutation.mutate({ stampId, current });
    },
  };
}
