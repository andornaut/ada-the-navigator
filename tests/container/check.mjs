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

// The project's check recipes, in Archie's shape: Make launches the container, which runs a
// category here, and the native npm aliases call the same recipes in the current environment.
// - check: every category in CHECK_TASKS (lint, test and build), in order.
// - lint: typecheck, the hook proof (a scratch repository's pre-commit hook accepts and refuses
//   as it should) and lint-only.
// - typecheck: TypeScript alone, with no project code run, so it also runs in a plain Node
//   container.
// - lint-only: ShellCheck, Prettier, ESLint and markdownlint.
// - test: Vitest with at most four workers, then the same suite in further launch-seed worlds
//   (tools/test-worlds.mjs), so a test that passes only in the default world fails.
// - build: bundle, then Wrangler's packaging dry run of dist/.
// - bundle: the Vite build, naming the checked commit.
const [category = "check", ...args] = process.argv.slice(2);
const evidence = "/tmp/evidence";

// The checks run only inside the isolated check container. typecheck (TypeScript reads the
// sources and runs none) and bundle (the Vite build, which npm run build and preview use) run
// anywhere, a plain Node container included.
const ANYWHERE = new Set(["bundle", "typecheck"]);
const contained = !ANYWHERE.has(category);
if (
  contained &&
  (process.getuid?.() !== 19001 ||
    !existsSync("/.dockerenv") ||
    !["/work", "/tmp/work"].includes(process.cwd()))
) {
  console.error("Checks require UID 19001 inside the isolated container at /work or /tmp/work.");
  process.exit(2);
}
// The build's commit for the kit's gameViteConfig: a deploy gate's own WORKERS_CI_COMMIT_SHA, else
// the checked revision, since the container has no Git metadata.
if (!process.env.WORKERS_CI_COMMIT_SHA && process.env.CHECK_REVISION) {
  process.env.WORKERS_CI_COMMIT_SHA = process.env.CHECK_REVISION;
}

const node = (script, ...rest) => ["node", script, ...rest];
const RECIPES = {
  build: [
    ["bundle"],
    node(
      "node_modules/wrangler/bin/wrangler.js",
      "deploy",
      "--config",
      "wrangler.jsonc",
      "--no-bundle",
      "--dry-run",
    ),
  ],
  bundle: [node("node_modules/vite/bin/vite.js", "build")],
  check: (process.env.CHECK_TASKS || "lint test build")
    .split(/\s+/)
    .filter(Boolean)
    .map((task) => [task]),
  lint: [
    ["typecheck"],
    node("tools/hooks-smoke.mjs", "--output", `${evidence}/hooks.json`),
    ["lint-only"],
  ],
  "lint-only": [
    ["shellcheck", "--version"],
    ["shellcheck", "--", "tests/container/run", "tests/container/check", "tests/container/admit"],
    ["shellcheck", "--shell=sh", "--", ".husky/pre-commit"],
    node("node_modules/prettier/bin/prettier.cjs", "--check", "."),
    node("node_modules/eslint/bin/eslint.js", "--max-warnings", "0", "."),
    node("node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs"),
  ],
  test: [
    node("node_modules/vitest/vitest.mjs", "run", "--maxWorkers=4", ...args),
    node("tools/test-worlds.mjs", "--maxWorkers=4", ...args),
  ],
  typecheck: [node("node_modules/typescript/bin/tsc", "--noEmit")],
};
if (!Object.hasOwn(RECIPES, category) || (category !== "test" && args.length)) {
  console.error(
    `Usage: tests/container/check <${Object.keys(RECIPES).sort().join("|")}> [test arguments]`,
  );
  process.exit(2);
}

if (contained) {
  mkdirSync(evidence, { recursive: true });
}
if (!existsSync("node_modules")) {
  // Vite writes .vite and .vite-temp beside packages, so the dependency root stays writable.
  mkdirSync("node_modules");
  for (const entry of readdirSync("/opt/check/node_modules")) {
    if (entry !== ".vite" && entry !== ".vite-temp") {
      symlinkSync(`/opt/check/node_modules/${entry}`, `node_modules/${entry}`);
    }
  }
}
// The hook proof makes its own scratch repository; ESLint and Prettier read .git/info/exclude.
if (["check", "lint", "lint-only"].includes(category)) {
  if (!existsSync(".git")) {
    const initialized = spawnSync("git", ["init", "--quiet", "--initial-branch", "main"], {
      stdio: "inherit",
    });
    if (initialized.error || initialized.status !== 0) {
      console.error(initialized.error?.message ?? "Cannot initialize scratch Git checkout.");
      process.exit(initialized.status || 1);
    }
  }
  mkdirSync(".git/info", { recursive: true });
  appendFileSync(".git/info/exclude", "\n/node_modules\n");
}

// Runs a category's steps: another category by name, or a command. Inside the container each
// category logs its environment as it starts and its caches as it ends.
function run(name) {
  if (contained) {
    const nofile = readFileSync("/proc/self/limits", "utf8")
      .split("\n")
      .find((line) => line.startsWith("Max open files"))
      ?.trim();
    console.error(
      JSON.stringify({
        event: "check-category",
        category: name,
        uid: process.getuid(),
        workspaceUid: lstatSync(".").uid,
        workspaceGid: lstatSync(".").gid,
        cwd: process.cwd(),
        node: process.version,
        nofile,
        sourceArchiveSha256: process.env.CHECK_SOURCE_SHA256 ?? null,
        revision: process.env.CHECK_REVISION ?? null,
        dependencyRootDirectory: lstatSync("node_modules").isDirectory(),
      }),
    );
  }
  for (const step of RECIPES[name]) {
    if (step.length === 1 && Object.hasOwn(RECIPES, step[0])) {
      run(step[0]);
      continue;
    }
    const [command, ...rest] = step;
    const result = spawnSync(command, rest, { stdio: "inherit" });
    if (result.error || result.status !== 0) {
      console.error(
        result.error?.message ?? `${step.join(" ")} failed: ${result.signal ?? result.status}`,
      );
      process.exit(result.status || 1);
    }
  }
  if (contained) {
    console.error(
      JSON.stringify({
        event: "check-category-complete",
        category: name,
        viteTemp: existsSync("node_modules/.vite-temp"),
        viteCache: existsSync("node_modules/.vite"),
        hookProof:
          name === "lint" ? JSON.parse(readFileSync(`${evidence}/hooks.json`, "utf8")) : null,
      }),
    );
  }
}
run(category);
