import { loadavg } from "node:os";

const [phase, ...extra] = process.argv.slice(2);
if (!["build-image", "lint", "test", "build", "exec"].includes(phase) || extra.length) {
  console.error("Resource admission requires one known phase.");
  process.exit(2);
}
const load1 = loadavg()[0];
const allowed = load1 < 20;
console.error(JSON.stringify({ event: "resource-admission", phase, load1, limit: 20, allowed }));
process.exitCode = allowed ? 0 : 1;
