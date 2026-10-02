import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

export const TYPE_CPS = 38; // characters a second

/** How many characters have been typed after `elapsedMs`. */
export function typedCount(elapsedMs: number, length: number, cps = TYPE_CPS): number {
  return Math.max(0, Math.min(length, Math.floor((elapsedMs / 1000) * cps)));
}

/** Types `text` out a character at a time. With Reduce Motion, all of it at once. */
export function useTypewriter(text: string): number {
  const reduced = useReducedMotion();
  // The count belongs to the text it was typed for, so new text starts again from nothing without an effect to reset it.
  const [typed, setTyped] = useState({ text, n: 0 });
  useEffect(() => {
    if (reduced) return;
    const start = Date.now();
    const id = setInterval(() => {
      const n = typedCount(Date.now() - start, text.length);
      setTyped({ text, n });
      if (n >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text, reduced]);
  if (reduced) return text.length;
  return typed.text === text ? typed.n : 0;
}
