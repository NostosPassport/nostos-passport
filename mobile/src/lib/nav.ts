/**
 * Navigation with a double-tap guard. A second identical push/back within a short window is ignored, so a fast
 * double tap cannot push the same screen twice or pop two screens. Different destinations are never blocked.
 */
import { router, type Href } from "expo-router";

const WINDOW_MS = 600;
let last: { key: string; at: number } | null = null;

function once(key: string, run: () => void) {
  const at = Date.now();
  if (last && last.key === key && at - last.at < WINDOW_MS) return;
  last = { key, at };
  run();
}

export const nav = {
  push(href: Href) {
    once(`push:${JSON.stringify(href)}`, () => router.push(href));
  },
  back() {
    once("back", () => router.back());
  },
  /** Test hook: forget the last navigation. */
  reset() {
    last = null;
  },
};
