import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

// Exercise the installed dispatcher with staged files in disposable container scratch.
execFileSync("npm", ["run", "prepare"], { stdio: "inherit" });
assert.ok(existsSync(".husky/_/pre-commit"), "prepare must install the pre-commit dispatcher");
const hook = [".husky/_/pre-commit"];
const proof = { acceptedAndFormatted: false, rejectedInvalidSource: false };
try {
  writeFileSync("hook-check.ts", "export const hookCheck={value:true};\n");
  writeFileSync("hook-check.md", "# Hook check\n");
  execFileSync("git", ["add", "hook-check.ts", "hook-check.md"]);
  execFileSync("sh", hook, { stdio: "inherit" });
  const formatted = readFileSync("hook-check.ts", "utf8");
  assert.equal(formatted, "export const hookCheck = { value: true };\n");
  assert.equal(execFileSync("git", ["show", ":hook-check.ts"], { encoding: "utf8" }), formatted);
  proof.acceptedAndFormatted = true;
  execFileSync("git", ["reset", "--quiet"]);
  writeFileSync("hook-check.ts", "export const broken = ;\n");
  execFileSync("git", ["add", "hook-check.ts"]);
  const rejected = spawnSync("sh", hook, { stdio: "inherit" });
  assert.equal(rejected.error, undefined);
  assert.notEqual(rejected.status, null);
  assert.notEqual(rejected.status, 0, "the installed hook must reject invalid staged TypeScript");
  assert.match(execFileSync("git", ["show", ":hook-check.ts"], { encoding: "utf8" }), /broken = ;/);
  proof.rejectedInvalidSource = true;
  writeFileSync("/tmp/evidence/hook-proof.json", `${JSON.stringify(proof, null, 2)}\n`);
} finally {
  execFileSync("git", ["reset", "--quiet"]);
  for (const name of ["hook-check.ts", "hook-check.md"]) {
    if (existsSync(name)) {
      unlinkSync(name);
    }
  }
}
