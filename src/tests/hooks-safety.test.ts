import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

it("proves real hooks in scratch without changing a dirty caller index or working files", () => {
  const caller = mkdtempSync(join(tmpdir(), "ada-hook-caller-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: caller });
  git("init", "--quiet", "--initial-branch", "main");
  writeFileSync(join(caller, "dirty.txt"), "staged bytes\n");
  git("add", "dirty.txt");
  writeFileSync(join(caller, "dirty.txt"), "unstaged bytes\n");
  mkdirSync(join(caller, ".husky"));
  writeFileSync(join(caller, ".husky/pre-commit"), "caller hook must remain unchanged\n");
  const output = join(caller, "proof/hooks.json");
  const fingerprint = () =>
    createHash("sha256")
      .update(readFileSync(join(caller, ".git/index")))
      .update(readFileSync(join(caller, "dirty.txt")))
      .update(readFileSync(join(caller, ".husky/pre-commit")))
      .update(git("diff", "--cached", "--binary"))
      .update(git("diff", "--binary"))
      .digest("hex");
  const before = fingerprint();
  const result = spawnSync(
    process.execPath,
    [join(root, "tools/hooks-smoke.mjs"), "--output", output],
    {
      cwd: caller,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_DIR: join(caller, ".git"),
        GIT_INDEX_FILE: join(caller, ".git/index"),
      },
      timeout: 15000,
    },
  );
  expect(fingerprint()).toBe(before);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(output, "utf8"))).toEqual({ positive: true, negative: true });
  expect(result.stdout).toContain('"event":"hook-proof"');
});
