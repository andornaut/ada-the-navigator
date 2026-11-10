import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output")) {
  throw new Error("Usage: node tools/hooks-smoke.mjs [--output <proof.json>]");
}
const scratch = mkdtempSync(join(tmpdir(), "ada-hooks-"));
const project = join(scratch, "project");
mkdirSync(project);
const output = args.length ? resolve(args[1]) : join(scratch, "hooks.json");
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);
env.HUSKY = "1";
const options = { cwd: project, env };
const run = (command, args, extra = {}) => execFileSync(command, args, { ...options, ...extra });
for (const name of [
  "package.json",
  ".lintstagedrc",
  "lint-staged.config.mjs",
  "eslint.config.mjs",
  "eslint.config.base.mjs",
  ".prettierrc",
  ".prettierignore",
  ".markdownlint-cli2.yaml",
]) {
  cpSync(join(root, name), join(project, name));
}
mkdirSync(join(project, ".husky"));
cpSync(join(root, ".husky/pre-commit"), join(project, ".husky/pre-commit"));
symlinkSync(join(root, "node_modules"), join(project, "node_modules"));
run("git", ["init", "--quiet", "--initial-branch", "main"]);
// All prepare, staging, formatting and reset operations belong to this scratch repository.
run("npm", ["run", "prepare"], { stdio: "inherit" });
assert.ok(
  existsSync(join(project, ".husky/_/pre-commit")),
  "prepare must install the pre-commit dispatcher",
);
const fixtures = ["hook-check.ts", "hook-check.md", "hook-invalid.ts"];
const proof = { positive: false, negative: false };
try {
  writeFileSync(join(project, fixtures[0]), "export const hookCheck={ready:true};\n");
  writeFileSync(join(project, fixtures[1]), "# Hook check\n");
  run("git", ["add", fixtures[0], fixtures[1]]);
  run("sh", [".husky/_/pre-commit"], { stdio: "inherit" });
  const expected = "export const hookCheck = { ready: true };\n";
  assert.equal(
    readFileSync(join(project, fixtures[0]), "utf8"),
    expected,
    "Hook must format the working file",
  );
  assert.equal(
    run("git", ["show", `:${fixtures[0]}`], { encoding: "utf8" }),
    expected,
    "Hook must stage its formatted result",
  );
  proof.positive = true;
  run("git", ["reset", "--quiet"]);
  writeFileSync(join(project, fixtures[2]), "export const hookInvalid: any = true;\n");
  run("git", ["add", fixtures[2]]);
  const rejected = spawnSync("sh", [".husky/_/pre-commit"], { ...options, encoding: "utf8" });
  if (rejected.error) {
    throw rejected.error;
  }
  assert.ok(
    rejected.status !== null && rejected.status !== 0,
    "Hook must reject an ESLint violation",
  );
  assert.match(
    `${rejected.stdout}\n${rejected.stderr}`,
    /@typescript-eslint\/no-explicit-any/,
    "Failure must come from the staged ESLint rule",
  );
  proof.negative = true;
} finally {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(proof)}\n`);
  console.log(JSON.stringify({ event: "hook-proof", project, output, ...proof }));
  run("git", ["reset", "--quiet"]);
  for (const fixture of fixtures) {
    if (existsSync(join(project, fixture))) {
      unlinkSync(join(project, fixture));
    }
  }
}
