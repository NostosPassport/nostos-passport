// Runs the DB-backed integration suite through PgBouncer in transaction-pooling mode (Neon's pooler mode),
// with migrations over a direct connection, exactly like production: DATABASE_URL pooled, DIRECT_URL direct.
// Proves that transaction-scoped advisory locks and interactive transactions work behind the pooler.
import { execSync } from "node:child_process";
import net from "node:net";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("docker compose --profile pooler up -d pooler");
// Wait until PgBouncer itself accepts TCP connections on the published port.
const reachable = () =>
  new Promise((resolve) => {
    const s = net.connect(6439, "127.0.0.1", () => (s.end(), resolve(true)));
    s.on("error", () => resolve(false));
  });
let up = false;
for (let i = 0; i < 40 && !(up = await reachable()); i++) await new Promise((r) => setTimeout(r, 250));
if (!up) throw new Error("PgBouncer did not come up on :6439");
run("pnpm exec vitest run --project integration", {
  TEST_DATABASE_URL: "postgresql://nostos:nostos@localhost:6439/nostos_codex_test?schema=public&pgbouncer=true",
  TEST_DIRECT_URL: "postgresql://nostos:nostos@localhost:5438/nostos_codex_test?schema=public",
});
