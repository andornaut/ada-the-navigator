import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
} from "node:fs";

if (
  process.getuid?.() !== 19001 ||
  !existsSync("/.dockerenv") ||
  !["/work", "/tmp/work"].includes(process.cwd())
) {
  console.error("Checks require UID 19001 inside the isolated container at /work or /tmp/work.");
  process.exit(2);
}
const [category, ...args] = process.argv.slice(2);
const categories = {
  lint: ["internal:hooks", "internal:types", "internal:lint"],
  test: ["internal:test"],
  build: ["internal:build", "internal:cloudflare", "internal:wrangler"],
};
if (!Object.hasOwn(categories, category) || (category !== "test" && args.length)) {
  console.error("Usage: tests/container/check <lint|test|build> [test arguments]");
  process.exit(2);
}
mkdirSync("/tmp/evidence", { recursive: true });
if (!existsSync("node_modules")) {
  // Vite writes .vite and .vite-temp beside packages, so the dependency root stays writable.
  mkdirSync("node_modules");
  for (const entry of readdirSync("/opt/check/node_modules")) {
    if (entry !== ".vite" && entry !== ".vite-temp") {
      symlinkSync(`/opt/check/node_modules/${entry}`, `node_modules/${entry}`);
    }
  }
}
if (category === "lint" && !existsSync(".git")) {
  const initialized = spawnSync("git", ["init", "--quiet", "--initial-branch", "main"], {
    stdio: "inherit",
  });
  if (initialized.error || initialized.status !== 0) {
    console.error(initialized.error?.message ?? "Cannot initialize scratch Git checkout.");
    process.exit(initialized.status || 1);
  }
}
if (category === "lint") {
  mkdirSync(".git/info", { recursive: true });
  appendFileSync(".git/info/exclude", "\n/node_modules\n");
}
const nofile = readFileSync("/proc/self/limits", "utf8")
  .split("\n")
  .find((line) => line.startsWith("Max open files"))
  ?.trim();
console.error(
  JSON.stringify({
    event: "check-category",
    category,
    uid: process.getuid(),
    cwd: process.cwd(),
    node: process.version,
    nofile,
    sourceArchiveSha256: process.env.CHECK_SOURCE_SHA256 ?? null,
    revision: process.env.CHECK_REVISION ?? null,
    dependencyRootDirectory: lstatSync("node_modules").isDirectory(),
  }),
);
for (const script of categories[category]) {
  const extra = category === "test" ? ["--", ...args, "--maxWorkers=4"] : [];
  const result = spawnSync("npm", ["run", script, ...extra], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `${script} failed: ${result.signal ?? result.status}`);
    process.exit(result.status || 1);
  }
}

console.error(
  JSON.stringify({
    event: "check-category-complete",
    category,
    viteTemp: existsSync("node_modules/.vite-temp"),
    viteCache: existsSync("node_modules/.vite"),
    hookProof:
      category === "lint" ? JSON.parse(readFileSync("/tmp/evidence/hooks.json", "utf8")) : null,
  }),
);
