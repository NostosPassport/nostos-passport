import { useMe } from "@/api/queries";
import { useAuth, type AuthStatus } from "./auth-context";

/**
 * What the app knows about the account right now, for deciding what an account-only control (Stamp, Passport) shows:
 *  - checking: a token is being validated or /api/me is loading. Never show "Sign in" in this state.
 *  - error: signed in, but /api/me failed. Offer a retry, not a sign-in.
 *  - guest: signed out or browsing as a guest. Sign-in is the right prompt.
 *  - ready: signed in and the account loaded.
 */
export type AccountState = "checking" | "error" | "guest" | "ready";

export function accountState(status: AuthStatus, me: { isSuccess: boolean; isError: boolean }): AccountState {
  if (status === "loading") return "checking";
  if (status === "signedOut" || status === "guest") return "guest";
  if (me.isSuccess) return "ready";
  if (me.isError) return "error";
  return "checking";
}

export function useAccountState(): { state: AccountState; retry: () => void; retrying: boolean } {
  const { status } = useAuth();
  const me = useMe();
  return { state: accountState(status, me), retry: () => void me.refetch(), retrying: me.isFetching };
}
