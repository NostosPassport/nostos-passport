/** The one-time hint on the closed passport. Remembered on the phone only. */
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

export const FIRST_RUN_KEY = "nostos.firstRun.passport.v1";

export const FIRST_RUN_COPY = {
  title: "This is your passport",
  body: "Tap the cover to open it. When you're at a place, tap Stamp to add your first stamp.",
  button: "Got it",
};

export async function hasSeenFirstRun(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(FIRST_RUN_KEY)) === "1";
  } catch {
    return true; // if it can't be read, don't nag
  }
}

export async function markFirstRunSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(FIRST_RUN_KEY, "1");
  } catch {
    // Nothing to do: the hint may show once more.
  }
}

/** `show` is true only after we know it hasn't been seen (never while loading). `dismiss` remembers it. */
export function useFirstRun(): { show: boolean; dismiss: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void hasSeenFirstRun().then((s) => alive && setSeen(s));
    return () => {
      alive = false;
    };
  }, []);
  const dismiss = useCallback(() => {
    setSeen(true);
    void markFirstRunSeen();
  }, []);
  return { show: seen === false, dismiss };
}
