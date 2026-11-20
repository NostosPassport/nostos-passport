/**
 * Typed visit dates (MM/DD/YYYY) for Past stamps and for editing a stamp's date. One parser and one set of rules
 * for the composer and Edit memory (RC-11): a visit date can't be in the future and can't be more than a year back.
 */
import { useState } from "react";

import { formatBirthdateInput } from "@/lib/age";

/** A little over a year, so the same calendar day last year is still allowed. */
export const VISIT_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
export const VISIT_DATE_LENGTH = 10;

export const VISIT_DATE_MESSAGES = {
  incomplete: "Enter the date as MM/DD/YYYY.",
  invalid: "That isn't a real date. Use MM/DD/YYYY.",
  future: "That date is in the future.",
  tooOld: "Pick a date within the last year.",
} as const;

export type VisitDateProblem = keyof typeof VISIT_DATE_MESSAGES;
export type VisitDateCheck = { ok: true; date: Date } | { ok: false; problem: VisitDateProblem; message: string };

/** Keeps only digits and inserts the slashes as you type. */
export const formatVisitDateInput = (raw: string): string => formatBirthdateInput(raw);

/** MM/DD/YYYY for a local date. */
export function visitDateText(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

/** A real calendar date at local noon, or null. */
export function parseVisitDate(value: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** Checks a typed date against the visit window. The future is judged by calendar day, so "today" is always fine. */
export function checkVisitDate(value: string, now: number): VisitDateCheck {
  const trimmed = value.trim();
  if (trimmed.length < VISIT_DATE_LENGTH) return { ok: false, problem: "incomplete", message: VISIT_DATE_MESSAGES.incomplete };
  const date = parseVisitDate(trimmed);
  if (!date) return { ok: false, problem: "invalid", message: VISIT_DATE_MESSAGES.invalid };
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (date.getTime() > endOfToday.getTime()) return { ok: false, problem: "future", message: VISIT_DATE_MESSAGES.future };
  if (date.getTime() < now - VISIT_WINDOW_MS) return { ok: false, problem: "tooOld", message: VISIT_DATE_MESSAGES.tooOld };
  return { ok: true, date };
}

/**
 * State for a typed visit-date field. The error is only shown once the date is complete (10 characters) or the
 * field has lost focus, so deleting a digit to retype it never flashes red (P-084). `check` is always current, so
 * a submit button can stay disabled while the date is incomplete.
 */
export function useVisitDateField(initial: string, now: number) {
  const [text, setTextState] = useState(initial);
  const [blurred, setBlurred] = useState(false);
  const check = checkVisitDate(text, now);
  const showError = text.length >= VISIT_DATE_LENGTH || blurred;
  return {
    text,
    check,
    /** The message to show under the field, or null while the person is still typing. */
    error: showError && !check.ok ? check.message : null,
    setText: (raw: string) => { setTextState(formatVisitDateInput(raw)); setBlurred(false); },
    onBlur: () => setBlurred(true),
    /** Props for the TextInput: number pad with a Done bar, and the whole date selected on focus so typing replaces it (P-083, P-085). */
    inputProps: {
      keyboardType: "number-pad" as const,
      maxLength: VISIT_DATE_LENGTH,
      placeholder: "MM/DD/YYYY",
      returnKeyType: "done" as const,
      inputAccessoryViewButtonLabel: "Done",
      selectTextOnFocus: true,
      autoCorrect: false,
      spellCheck: false,
    },
  };
}
