import { useMe } from "@/api/queries";
import { useAuth, type AuthStatus } from "./auth-context";

export type AccountState = "checking" | "error" | "ready";

export function accountState(status: AuthStatus, me: { isSuccess: boolean; isError: boolean }): AccountState {
  if (status !== "signedIn") return "checking";
  if (me.isSuccess) return "ready";
  if (me.isError) return "error";
  return "checking";
}

export function useAccountState(): { state: AccountState; retry: () => void; retrying: boolean } {
  const { status } = useAuth();
  const me = useMe();
  return { state: accountState(status, me), retry: () => void me.refetch(), retrying: me.isFetching };
}
