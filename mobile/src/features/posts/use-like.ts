import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { api, errorText } from "@/api";
import type { FeaturedMonthResponse, LikeSummary, PostView, VenuePageResponse } from "@/api/contracts";
import { qk } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";

/** What a like or unlike does to a summary, before the server answers. */
export function toggledLikes(current: LikeSummary): LikeSummary {
  const like = !current.viewerLiked;
  return { viewerLiked: like, count: Math.max(0, current.count + (like ? 1 : -1)) };
}

/** Put one post's like summary everywhere it's cached: post detail, venue pages (live, earlier, featured), month galleries. */
export function setLikes(queryClient: QueryClient, postId: string, likes: LikeSummary) {
  const swap = <T extends { id: string; likes: LikeSummary | null }>(photos: T[]): T[] =>
    photos.map((p) => (p.id === postId && p.likes ? { ...p, likes } : p));
  queryClient.setQueryData<{ post: PostView }>(qk.post(postId), (r) => (r?.post.likes ? { post: { ...r.post, likes } } : r));
  queryClient.setQueriesData<VenuePageResponse>({ queryKey: ["venue"] }, (page) =>
    page?.live
      ? {
          ...page,
          live: { ...page.live, livePhotos: swap(page.live.livePhotos), earlierPhotos: swap(page.live.earlierPhotos) },
          featured: { ...page.featured, thisMonth: { ...page.featured.thisMonth, photos: swap(page.featured.thisMonth.photos) } },
        }
      : page,
  );
  queryClient.setQueriesData<FeaturedMonthResponse>({ queryKey: ["featured"] }, (m) =>
    m ? { ...m, nights: m.nights.map((n) => ({ ...n, photos: swap(n.photos) })) } : m,
  );
}

/**
 * Like or unlike a shared post, optimistically, with a light haptic. Signed-out taps go to sign-in. A second tap
 * while one is in flight is ignored, so the count can't drift.
 */
export function useLike() {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const mutation = useMutation({
    mutationFn: (v: { postId: string; current: LikeSummary }) => api.posts.like(v.postId, !v.current.viewerLiked),
    onMutate: ({ postId, current }) => {
      haptics.select();
      setLikes(queryClient, postId, toggledLikes(current));
    },
    onSuccess: (res, { postId }) => setLikes(queryClient, postId, { count: res.count, viewerLiked: res.viewerLiked }),
    onError: (e, { postId, current }) => {
      haptics.warning();
      setLikes(queryClient, postId, current);
      toast.show(errorText(e, "Couldn't update that like. Try again."), "neutral");
    },
  });
  return {
    ...mutation,
    /** `current` is the summary the heart shows. `onlyLike` (double-tap) never unlikes. */
    toggle: (postId: string, current: LikeSummary, onlyLike = false) => {
      if (status !== "signedIn") return router.push("/sign-in");
      if (onlyLike && current.viewerLiked) return haptics.select();
      if (mutation.isPending && mutation.variables?.postId === postId) return;
      mutation.mutate({ postId, current });
    },
  };
}
