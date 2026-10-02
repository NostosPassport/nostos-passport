import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { api, errorText } from "@/api";
import type { FollowRequestsResponse, PeopleListResponse } from "@/api/contracts";
import { qk, useMe } from "@/api/queries";
import { toast } from "@/components/ui/toast";
import { plural } from "@/lib/format";
import { haptics } from "@/lib/haptics";

/** Everything a request decision or a removed follower changes: the list, the badge count, your counts, activity. */
function refreshSocial(queryClient: QueryClient, myHandle: string | undefined) {
  void queryClient.invalidateQueries({ queryKey: qk.followRequests });
  void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
  void queryClient.invalidateQueries({ queryKey: qk.activity });
  if (myHandle) {
    void queryClient.invalidateQueries({ queryKey: qk.user(myHandle) });
    void queryClient.invalidateQueries({ queryKey: qk.people(myHandle, "followers") });
  }
}

/** Approve or decline one request. The row leaves the list at once and comes back if the server says no. */
export function useDecideRequest() {
  const queryClient = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: (v: { handle: string; approve: boolean }) => api.me.decideRequest(v.handle, v.approve),
    onMutate: async ({ handle, approve }) => {
      if (approve) haptics.success();
      else haptics.select();
      await queryClient.cancelQueries({ queryKey: qk.followRequests });
      const saved = queryClient.getQueryData<FollowRequestsResponse>(qk.followRequests);
      if (saved) queryClient.setQueryData<FollowRequestsResponse>(qk.followRequests, { requests: saved.requests.filter((r) => r.person.handle !== handle) });
      return saved;
    },
    onError: (e, _v, saved) => {
      haptics.warning();
      if (saved) queryClient.setQueryData(qk.followRequests, saved);
      toast.show(errorText(e, "Couldn't update that request. Try again."), "neutral");
    },
    onSettled: () => refreshSocial(queryClient, me.data?.user.handle),
  });
}

/** Approve every pending request (after going public, or from the requests screen). */
export function useApproveAll() {
  const queryClient = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: api.me.approveAllRequests,
    onSuccess: (res) => {
      haptics.success();
      toast.show(res.approved > 0 ? `Approved ${plural(res.approved, "request")}` : "No requests to approve", "neutral");
    },
    onError: (e) => {
      haptics.warning();
      toast.show(errorText(e, "Couldn't approve those requests. Try again."), "neutral");
    },
    onSettled: () => refreshSocial(queryClient, me.data?.user.handle),
  });
}

/** "Approve 4 pending requests?" Used after switching to public and on the requests screen. */
export function confirmApproveAll(count: number, onApprove: () => void, onDone?: () => void) {
  Alert.alert(`Approve ${plural(count, "pending request")}?`, "They'll start following you.", [
    { text: "Not now", style: "cancel", onPress: onDone },
    {
      text: "Approve",
      onPress: () => {
        onApprove();
        onDone?.();
      },
    },
  ]);
}

/** Remove someone who follows you, after a confirmation. They aren't told; they can request again. */
export function useRemoveFollower() {
  const queryClient = useQueryClient();
  const me = useMe();
  const mutation = useMutation({
    mutationFn: (handle: string) => api.me.removeFollower(handle),
    onMutate: async (handle) => {
      const myHandle = me.data?.user.handle;
      if (!myHandle) return undefined;
      const key = qk.people(myHandle, "followers");
      await queryClient.cancelQueries({ queryKey: key });
      const saved = queryClient.getQueryData<PeopleListResponse>(key);
      if (saved) queryClient.setQueryData<PeopleListResponse>(key, { people: saved.people.filter((p) => p.handle !== handle) });
      return saved ? { key, saved } : undefined;
    },
    onSuccess: () => haptics.success(),
    onError: (e, _h, ctx) => {
      haptics.warning();
      if (ctx) queryClient.setQueryData(ctx.key, ctx.saved);
      toast.show(errorText(e, "Couldn't remove that follower. Try again."), "neutral");
    },
    onSettled: () => refreshSocial(queryClient, me.data?.user.handle),
  });
  return {
    ...mutation,
    confirm: (handle: string) =>
      Alert.alert(`Remove @${handle}?`, "They won't be told. They can ask to follow you again.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => mutation.mutate(handle) },
      ]),
  };
}
