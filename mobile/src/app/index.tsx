import { Redirect } from "expo-router";

import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";

export default function Index() {
  const { status } = useAuth();
  const me = useMe();

  if (status === "loading" || (status === "signedIn" && me.isLoading)) return null;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (!me.data) return <Redirect href="/connect" />;
  if (me.data.terms.needsAcceptance) return <Redirect href="/terms-update" />;
  return <Redirect href="/passport" />;
}
