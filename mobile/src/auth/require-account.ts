import { router } from "expo-router";
import { useCallback } from "react";

import { useAuth } from "./auth-context";

/**
 * Guard for account-only actions (post, RSVP, follow, flag). Guests are sent to sign in;
 * returns true when the action may proceed.
 */
export function useRequireAccount(): () => boolean {
  const { status } = useAuth();
  return useCallback(() => {
    if (status === "signedIn") return true;
    router.push("/sign-in");
    return false;
  }, [status]);
}
