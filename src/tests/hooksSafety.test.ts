import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

it.each(["explicit", "default"])(
  "protects a dirty caller during real hook proof with %s output",
  (mode) => {
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
      [join(root, "tools/hooks-smoke.mjs"), ...(mode === "explicit" ? ["--output", output] : [])],
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
    const event = result.stdout
      .split("\n")
      .find((line) => line.startsWith('{"event":"hook-proof"'));
    expect(event).toBeDefined();
    const proof = JSON.parse(event!);
    if (mode === "explicit") {
      expect(proof.output).toBe(output);
    } else {
      expect(proof.output.startsWith(caller)).toBe(false);
    }
    expect(JSON.parse(readFileSync(proof.output, "utf8"))).toEqual({
      negative: true,
      positive: true,
    });
    expect(result.stdout).toContain('"event":"hook-proof"');
  },
);
