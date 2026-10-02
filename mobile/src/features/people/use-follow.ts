import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, errorText } from "@/api";
import type { FollowState, PeopleListResponse, ProfileResponse, UserSearchResponse } from "@/api/contracts";
import { qk, useMe } from "@/api/queries";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import type { SymbolName } from "@/components/ui/icon";

const SEARCH = ["users", "search"] as const;
const LISTS = ["users", "connections"] as const;

/** Button copy for a follow state. Private accounts answer a follow with "Requested". */
export function followButton(state: FollowState, handle: string): { title: string; icon: SymbolName; variant: "primary" | "secondary"; label: string } {
  if (state === "following") return { title: "Following", icon: "checkmark", variant: "secondary", label: `Unfollow @${handle}` };
  if (state === "requested") return { title: "Requested", icon: "clock", variant: "secondary", label: `Cancel follow request to @${handle}` };
  return { title: "Follow", icon: "plus", variant: "primary", label: `Follow @${handle}` };
}

function withFollowers(p: ProfileResponse, from: FollowState, to: FollowState): ProfileResponse {
  const relationship = { ...p.relationship, follow: to, mutual: to === "following" && p.relationship.followsYou };
  if (p.access !== "full") return { ...p, relationship };
  const delta = (to === "following" ? 1 : 0) - (from === "following" ? 1 : 0);
  return { ...p, relationship, user: { ...p.user, counts: { ...p.user.counts, followers: Math.max(0, p.user.counts.followers + delta) } } };
}

/**
 * Follow, request, unfollow or cancel. Unfollowing and cancelling are optimistic; a follow waits for the server,
 * which knows whether the account is private (it answers "requested") or public ("following"). In-flight fetches
 * are cancelled first, errors restore the saved copies, and `isPendingFor` lets buttons ignore taps until the
 * server answers, so a follow and an unfollow never race.
 */
export function useFollow() {
  const queryClient = useQueryClient();
  const me = useMe();

  const setState = (handle: string, from: FollowState, to: FollowState) => {
    const profile = queryClient.getQueryData<ProfileResponse>(qk.user(handle));
    if (profile) queryClient.setQueryData<ProfileResponse>(qk.user(handle), withFollowers(profile, from, to));
    const patch = <T extends { handle: string; follow: FollowState }>(rows: T[]) => rows.map((u) => (u.handle === handle ? { ...u, follow: to } : u));
    queryClient.setQueriesData<UserSearchResponse>({ queryKey: SEARCH }, (r) => (r ? { users: patch(r.users) } : r));
    queryClient.setQueriesData<PeopleListResponse>({ queryKey: LISTS }, (r) => (r ? { people: patch(r.people) } : r));
  };

  const mutation = useMutation({
    mutationFn: (v: { handle: string; current: FollowState }) => api.users.follow(v.handle, v.current === "none"),
    onMutate: async ({ handle, current }) => {
      haptics.select();
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.user(handle) }),
        queryClient.cancelQueries({ queryKey: SEARCH }),
        queryClient.cancelQueries({ queryKey: LISTS }),
      ]);
      const saved = {
        profile: queryClient.getQueryData<ProfileResponse>(qk.user(handle)),
        searches: queryClient.getQueriesData<UserSearchResponse>({ queryKey: SEARCH }),
        lists: queryClient.getQueriesData<PeopleListResponse>({ queryKey: LISTS }),
      };
      if (current !== "none") setState(handle, current, "none");
      return saved;
    },
    onSuccess: (res, { handle, current }) => {
      if (current === "none") setState(handle, "none", res.state);
      if (res.state === "requested") toast.show("Request sent", "neutral");
    },
    onError: (e, { handle }, saved) => {
      haptics.warning();
      if (saved?.profile) queryClient.setQueryData(qk.user(handle), saved.profile);
      for (const [key, data] of [...(saved?.searches ?? []), ...(saved?.lists ?? [])]) queryClient.setQueryData(key, data);
      toast.show(errorText(e, "Couldn't update that. Try again."), "neutral");
    },
    onSettled: (_r, _e, v) => {
      void queryClient.invalidateQueries({ queryKey: qk.user(v.handle) });
      void queryClient.invalidateQueries({ queryKey: qk.following });
      // Your own profile's Following count and list.
      const mine = me.data?.user.handle;
      if (mine) {
        void queryClient.invalidateQueries({ queryKey: qk.user(mine) });
        void queryClient.invalidateQueries({ queryKey: qk.people(mine, "following") });
      }
    },
  });

  return {
    ...mutation,
    /** Taps on a Follow / Requested / Following button: `current` is the state the button shows. */
    toggle: (handle: string, current: FollowState) => {
      if (mutation.isPending && mutation.variables?.handle === handle) return;
      mutation.mutate({ handle, current });
    },
    isPendingFor: (handle: string) => mutation.isPending && mutation.variables?.handle === handle,
  };
}
