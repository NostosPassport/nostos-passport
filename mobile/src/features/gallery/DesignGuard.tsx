import { Redirect } from "expo-router";
import type { ReactNode } from "react";

/** The Design gallery exists in development builds only. In a release build (`__DEV__` is false) it sends you home and shows nothing. */
export function DesignGuard({ children }: { children: ReactNode }) {
  if (!__DEV__) return <Redirect href="/" />;
  return <>{children}</>;
}
