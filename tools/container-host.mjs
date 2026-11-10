import { spawnSync } from "node:child_process";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [action, ...extra] = process.argv.slice(2);
if (!["check", "info", "lint", "test", "build"].includes(action) || extra.length) {
  console.error("Usage: node tools/container-host.mjs <check|info|lint|test|build>");
  process.exit(2);
}
if (action !== "info" && loadavg()[0] >= 20) {
  console.error("Check start blocked: one-minute load >=20.");
  process.exit(1);
}
const result = spawnSync(join(root, "tests/container/run"), [action], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error(result.error.message);
}
process.exitCode = result.status || (result.error || result.signal ? 1 : 0);
