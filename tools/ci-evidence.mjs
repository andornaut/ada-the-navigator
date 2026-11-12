import { createHash } from "node:crypto";
import { cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { snapshot } from "./checks.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const commands = { lint: "make lint", test: "make test build" };
const [action, mode, status, ...extra] = process.argv.slice(2);
if (
  !Object.hasOwn(commands, mode) ||
  !["begin", "finish"].includes(action) ||
  extra.length ||
  (action === "begin" ? status !== undefined : !/^\d+$/.test(status ?? ""))
) {
  throw new Error(
    "Usage: node tools/ci-evidence.mjs begin <lint|test> | finish <lint|test> <status>",
  );
}
const directory = join(root, ".check-results", `ci-${mode}`);
mkdirSync(directory, { recursive: true });
function save(name, value) {
  writeFileSync(join(directory, name), `${JSON.stringify(value, null, 2)}\n`);
}
function artifactHash(directory) {
  const hash = createHash("sha256");
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        visit(join(path, name));
      }
    } else if (stat.isFile()) {
      hash.update(relative(directory, path));
      hash.update(readFileSync(path));
    } else {
      throw new Error("Build artifact contains a non-regular file");
    }
  }
  visit(directory);
  return hash.digest("hex");
}
if (action === "begin") {
  save("source.json", snapshot());
} else {
  const before = JSON.parse(readFileSync(join(directory, "source.json"), "utf8"));
  const after = snapshot();
  const proof = {
    stable: before.fingerprint === after.fingerprint,
    exitCode: Number(status),
    before: before.fingerprint,
    after: after.fingerprint,
    beforeHead: before.head,
    afterHead: after.head,
    commands: [commands[mode]],
    provenance:
      "Explicit Make targets using the repository Dockerfile, not detached checks.mjs execution.",
  };
  if (proof.stable && proof.exitCode === 0 && mode === "test") {
    try {
      const dist = join(root, "dist");
      const artifact = artifactHash(dist);
      cpSync(dist, join(directory, "dist"), { recursive: true });
      if (artifact !== artifactHash(join(directory, "dist"))) {
        throw new Error("Evidence copy differs from the exported build");
      }
      save("artifact-receipt.json", { artifact, head: after.head, command: commands[mode] });
    } catch (error) {
      proof.exitCode = 1;
      save("artifact-error.json", { message: error.message });
    }
  }
  save("verification.json", proof);
  process.exitCode = proof.stable ? proof.exitCode : 125;
}
