import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

/** VoiceOver reads `message` whenever it appears or changes (iOS ignores accessibilityLiveRegion). */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
