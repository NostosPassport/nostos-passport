import { checkBirthdate } from "./age";

/**
 * Field hints for the sign-up form, mirroring the server's rules so people see problems before
 * submitting. The server still validates and its message wins.
 */
export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
export const MIN_PASSWORD = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupFields = { email: string; password: string; handle: string; displayName: string; birthdate: string };
export type SignupErrors = Partial<Record<keyof SignupFields, string>>;

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function validateSignup(f: SignupFields, now = new Date()): SignupErrors {
  const e: SignupErrors = {};
  if (!isEmail(f.email)) e.email = "Enter a valid email address.";
  if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (!HANDLE_RE.test(f.handle.trim().toLowerCase())) e.handle = "3 to 24 lowercase letters, numbers or underscores.";
  if (!f.displayName.trim()) e.displayName = "Enter the name people will see.";
  const age = checkBirthdate(f.birthdate, now);
  if (!age.ok) e.birthdate = age.message;
  return e;
}
