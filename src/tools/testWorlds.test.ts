import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

function invoke(status: number) {
  const scratch = mkdtempSync(join(tmpdir(), "ada-world-tests-"));
  const output = join(scratch, "calls.jsonl");
  writeFileSync(
    join(scratch, "npx"),
    `#!${process.execPath}
const fs = require('node:fs');
const call = {args:process.argv.slice(2),seed:process.env.ADA_LAUNCH_SEED};
fs.appendFileSync(${JSON.stringify(output)}, JSON.stringify(call)+'\\n');
process.exit(${status});
`,
    { mode: 0o755 },
  );
  const result = spawnSync(process.execPath, ["tools/test-worlds.mjs", "--maxWorkers=4"], {
    cwd: join(import.meta.dirname, "../.."),
    encoding: "utf8",
    env: { ...process.env, PATH: `${scratch}:${process.env.PATH}` },
  });
  const calls = readFileSync(output, "utf8")
    .trim()
    .split("\n")
    .map(
      (line) =>
        JSON.parse(line) as {
          args: string[];
          seed: string;
        },
    );
  return { calls, result };
}

it("repeats unaudited suites in all three worlds and excludes only the audited files", () => {
  const { calls, result } = invoke(0);
  expect(result.status, result.stderr).toBe(0);
  expect(calls.map((call) => call.seed)).toEqual(["803550167", "1343235941", "4155282460"]);
  for (const { args } of calls) {
    expect(args).toEqual([
      "vitest",
      "run",
      "--maxWorkers=4",
      "--passWithNoTests",
      "--exclude",
      "src/model/economy.test.ts",
      "--exclude",
      "src/pwa/index.test.ts",
      "--exclude",
      "src/tests/hooksSafety.test.ts",
      "--exclude",
      "src/tools/pacingSim.test.ts",
      "--exclude",
      "src/tools/phaserBuild.test.ts",
      "--exclude",
      "src/ui/resourceCard.test.ts",
    ]);
  }
});

it("stops at the first failing world and preserves its exit status", () => {
  const { calls, result } = invoke(17);
  expect(result.status).toBe(17);
  expect(calls).toHaveLength(1);
  expect(result.stderr).toContain("vitest failed in world 803550167: 17");
});
