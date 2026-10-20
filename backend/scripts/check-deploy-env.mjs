const appEnv = process.env.APP_ENV?.trim();
const deployed = process.env.VERCEL === "1" || appEnv === "preview" || appEnv === "production";

if (!deployed) {
  console.log("[deploy-check] local development, skipping deployment environment checks");
  process.exit(0);
}

const errors = [];

if (appEnv !== "preview" && appEnv !== "production") {
  errors.push("APP_ENV must be preview or production for a deployed backend");
}

const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "RESEND_API_KEY",
  "AUTH_EMAIL_FROM",
  "AUTH_COMPANY_ADDRESS",
  "RESEND_VERIFY_EMAIL_TEMPLATE_ID",
  "AUTH_CODE_SECRET",
  "CRON_SECRET",
  "SHARE_TOKEN_SECRET",
];

for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required`);
}

if ((process.env.STORAGE_DRIVER ?? "").toLowerCase() !== "r2") {
  errors.push("STORAGE_DRIVER must be r2 for preview/production");
}

for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = process.env[name] ?? "";
  if (/localhost|127\.0\.0\.1/.test(value)) errors.push(`${name} must not point to localhost`);
}

for (const name of ["AUTH_CODE_SECRET", "CRON_SECRET", "SHARE_TOKEN_SECRET"]) {
  if ((process.env[name] ?? "").length < 32) errors.push(`${name} must be at least 32 characters`);
}

const secrets = ["AUTH_CODE_SECRET", "CRON_SECRET", "SHARE_TOKEN_SECRET"];
for (let i = 0; i < secrets.length; i++) {
  for (let j = i + 1; j < secrets.length; j++) {
    const a = secrets[i];
    const b = secrets[j];
    if (process.env[a] && process.env[a] === process.env[b]) errors.push(`${a} and ${b} must be different values`);
  }
}

if ((process.env.AUTH_COMPANY_ADDRESS ?? "").trim() === "New York, NY") {
  errors.push("AUTH_COMPANY_ADDRESS must be a complete mailing address in preview/production");
}

if ((process.env.RESEND_VERIFY_EMAIL_TEMPLATE_ID ?? "").trim() !== "email-otp") {
  errors.push("RESEND_VERIFY_EMAIL_TEMPLATE_ID must be email-otp");
}

if (errors.length) {
  console.error("[deploy-check] deployment environment is not ready:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[deploy-check] ${appEnv} environment looks ready`);
