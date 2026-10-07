import { checkBirthdate } from "./age";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
export const HANDLE_RE = /^[a-z0-9._]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupFields = { email: string; handle: string; displayName: string; birthdate: string };
export type SignupErrors = Partial<Record<keyof SignupFields, string>>;

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function validateSignup(f: SignupFields, now = new Date()): SignupErrors {
  const e: SignupErrors = {};
  if (!isEmail(f.email)) e.email = "Enter a valid email address.";
  const handle = f.handle.trim().toLowerCase();
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX || !HANDLE_RE.test(handle)) {
    e.handle = `${HANDLE_MIN} to ${HANDLE_MAX} lowercase letters, numbers, periods or underscores.`;
  }
  if (!f.displayName.trim()) e.displayName = "Enter the name people will see.";
  const age = checkBirthdate(f.birthdate, now);
  if (!age.ok) e.birthdate = age.message;
  return e;
}
