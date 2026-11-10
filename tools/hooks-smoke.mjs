import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

// Exercise the installed hook in disposable container scratch, including staged files.
execFileSync("npm", ["run", "prepare"], { stdio: "inherit" });
assert.ok(existsSync(".husky/_/pre-commit"), "prepare must install the pre-commit dispatcher");
writeFileSync("hook-check.ts", "export const hookCheck = true;\n");
writeFileSync("hook-check.md", "# Hook check\n");
execFileSync("git", ["add", "hook-check.ts", "hook-check.md"]);
try {
  execFileSync("sh", [".husky/_/pre-commit"], { stdio: "inherit" });
} finally {
  execFileSync("git", ["reset", "--quiet"]);
  unlinkSync("hook-check.ts");
  unlinkSync("hook-check.md");
}
