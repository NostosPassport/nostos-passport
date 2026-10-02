import * as WebBrowser from "expo-web-browser";

import { api } from "@/api";
import { colors } from "@/theme";

export const LEGAL = {
  terms: "/terms",
  privacy: "/privacy",
  support: "/support",
} as const;

/** Opens one of the backend's public pages in the in-app browser (SFSafariViewController). */
export function openWebPage(path: string): void {
  void WebBrowser.openBrowserAsync(api.webUrl(path), {
    controlsColor: colors.accent,
    toolbarColor: colors.background,
    dismissButtonStyle: "close",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => undefined);
}

/** Any external https page (attribution, support) in the in-app browser. */
export function openExternal(url: string): void {
  void WebBrowser.openBrowserAsync(url, {
    controlsColor: colors.accent,
    toolbarColor: colors.background,
    dismissButtonStyle: "close",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => undefined);
}
