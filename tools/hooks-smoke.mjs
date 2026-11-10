import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

// Exercise the installed hook only in the gate's disposable container checkout.
execFileSync("npm", ["run", "prepare"], { stdio: "inherit" });
assert.ok(existsSync(".husky/_/pre-commit"), "prepare must install the pre-commit dispatcher");
const fixtures = ["hook-check.ts", "hook-check.md", "hook-invalid.ts"];
const proof = { positive: false, negative: false };
try {
  writeFileSync(fixtures[0], "export const hookCheck={ready:true};\n");
  writeFileSync(fixtures[1], "# Hook check\n");
  execFileSync("git", ["add", fixtures[0], fixtures[1]]);
  execFileSync("sh", [".husky/_/pre-commit"], { stdio: "inherit" });
  const expected = "export const hookCheck = { ready: true };\n";
  assert.equal(readFileSync(fixtures[0], "utf8"), expected, "Hook must format the working file");
  assert.equal(
    execFileSync("git", ["show", `:${fixtures[0]}`], { encoding: "utf8" }),
    expected,
    "Hook must stage its formatted result",
  );
  proof.positive = true;
  execFileSync("git", ["reset", "--quiet"]);
  writeFileSync(fixtures[2], "export const hookInvalid: any = true;\n");
  execFileSync("git", ["add", fixtures[2]]);
  const rejected = spawnSync("sh", [".husky/_/pre-commit"], { encoding: "utf8" });
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
  writeFileSync("/tmp/evidence/hooks.json", `${JSON.stringify(proof)}\n`);
  execFileSync("git", ["reset", "--quiet"]);
  for (const fixture of fixtures) {
    if (existsSync(fixture)) {
      unlinkSync(fixture);
    }
  }
}
