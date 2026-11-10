import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const containerId = "c".repeat(64);
const fakeDocker = `#!${process.execPath}
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
const command = args[0];
const scenario = process.env.CHECK_STARTUP_CASE;
const entry = {command, target: command === 'create' ? null : args.at(-1)};
appendFileSync(process.env.PROOF_COMMANDS, JSON.stringify(entry) + '\\n');
if (command === 'create') {
  if (scenario === 'create-fails') { console.error('fixture create failure'); process.exit(17); }
  console.log('${containerId}');
} else if (command === 'start') {
  if (scenario !== 'success') { console.error('fixture start failure'); process.exit(23); }
  console.log('${containerId}');
} else if (command === 'inspect') {
  if (scenario === 'inspect-fails') { console.error('fixture inspection failure'); process.exit(42); }
  const running = scenario === 'running';
  const exited = scenario === 'exited';
  console.log(JSON.stringify({
    id:'${containerId}', status:running?'running':exited?'exited':'created', running,
    startedAt:running||exited?'2026-11-10T00:00:00Z':'0001-01-01T00:00:00Z'
  }));
} else if (command === 'rm') {
  if (scenario === 'remove-fails') { console.error('fixture removal failure'); process.exit(43); }
} else { throw new Error('Unexpected Docker command: ' + command); }
`;

// Run the real CLI with controlled Docker responses, inside the existing isolated test gate.
function attempt(scenario: string) {
  const scratch = mkdtempSync(join(tmpdir(), "ada-startup-"));
  const project = join(scratch, "project");
  mkdirSync(join(project, "tools"), { recursive: true });
  cpSync(join(root, "tools/checks.mjs"), join(project, "tools/checks.mjs"));
  writeFileSync(join(project, "package.json"), '{"private":true,"type":"module"}\n');
  writeFileSync(join(project, ".gitignore"), ".check-results/\n");
  execFileSync("git", ["init", "--quiet", "--initial-branch", "main"], { cwd: project });
  execFileSync("git", ["add", "."], { cwd: project });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fixture User",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--message",
      "Create fixture checkout",
    ],
    { cwd: project },
  );
  const commandsPath = join(scratch, "commands.jsonl");
  writeFileSync(join(scratch, "docker"), fakeDocker, { mode: 0o755 });
  const preload = `import os from 'node:os'; import {syncBuiltinESMExports} from 'node:module';
let calls = 0;
os.loadavg = () => [${JSON.stringify(scenario)} === 'load-rises' && ++calls >= 3 ? 20 : 0,0,0];
syncBuiltinESMExports();`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(preload)}`,
      join(project, "tools/checks.mjs"),
      "start",
      "all",
    ],
    {
      cwd: project,
      encoding: "utf8",
      env: {
        ...process.env,
        CHECK_STARTUP_CASE: scenario,
        PATH: `${scratch}:${process.env.PATH}`,
        PROOF_COMMANDS: commandsPath,
      },
      timeout: 10000,
    },
  );
  if (result.error) {
    throw result.error;
  }
  const name = `${result.stdout}\n${result.stderr}`.match(/ada-check-[a-f0-9-]{36}/)?.[0];
  expect(name).toBeDefined();
  const receipt = JSON.parse(
    readFileSync(resolve(project, ".check-results", name!, "startup.json"), "utf8"),
  );
  const commands = readFileSync(commandsPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { command: string; target: string | null });
  return { commands, receipt, result };
}

describe("isolated check startup ownership", () => {
  it("records the created ID and starts it without removing a healthy container", () => {
    const { commands, receipt, result } = attempt("success");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(receipt.name);
    expect(receipt.containerId).toBe(containerId);
    expect(receipt.stage).toBe("started");
    expect(commands).toEqual([
      { command: "create", target: null },
      { command: "start", target: containerId },
    ]);
  });

  it("removes only its owned unstarted container when load rises after creation", () => {
    const { commands, receipt, result } = attempt("load-rises");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("load >=20");
    expect(result.stderr).toContain("startup.json");
    expect(receipt.cleanup).toBe("removed-unstarted");
    expect(commands.map(({ command }) => command)).toEqual(["create", "inspect", "rm"]);
    expect(commands.at(-1)?.target).toBe(containerId);
  });

  it("preserves a failed create's exit status and reports unconfirmed ownership", () => {
    const { commands, receipt, result } = attempt("create-fails");
    expect(result.status).toBe(17);
    expect(result.stderr).toContain("fixture create failure");
    expect(receipt.containerId).toBeNull();
    expect(receipt.recovery).toContain("Creation is unconfirmed");
    expect(commands).toEqual([{ command: "create", target: null }]);
  });

  it("cleans up an unstarted container after Docker rejects start", () => {
    const { commands, receipt, result } = attempt("start-fails");
    expect(result.status).toBe(23);
    expect(receipt.cleanup).toBe("removed-unstarted");
    expect(commands.at(-1)).toEqual({ command: "rm", target: containerId });
  });

  it.each(["running", "exited"])(
    "retains a %s container after an ambiguous start failure",
    (scenario) => {
      const { commands, receipt, result } = attempt(scenario);
      expect(result.status).toBe(23);
      expect(receipt.cleanup).toBe("retained");
      expect(receipt.recovery).toContain(`collect ${receipt.name}`);
      expect(commands.some(({ command }) => command === "rm")).toBe(false);
    },
  );

  it.each(["inspect-fails", "remove-fails"])(
    "does not mask the start error when cleanup %s",
    (scenario) => {
      const { receipt, result } = attempt(scenario);
      expect(result.status).toBe(23);
      expect(result.stderr).toContain("fixture start failure");
      expect(receipt.cleanup).toBe("retained");
      expect(receipt.cleanupError).toContain("fixture");
    },
  );
});
