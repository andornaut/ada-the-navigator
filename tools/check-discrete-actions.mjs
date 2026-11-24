import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { scanDiscreteActionProject } from "../src/testing/discreteActionArchitecture.ts";

const root = process.cwd();
const sources = [];
const inputs = [];
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      const text = readFileSync(file, "utf8");
      const path = relative(root, file);
      inputs.push({ path, sha256: createHash("sha256").update(text).digest("hex") });
      sources.push({ path, text });
    }
  }
}
inspect(join(root, "src"));
const { factoryAssociations, findings, runtimeAssertions, unresolvedRuntimeAssertions } =
  scanDiscreteActionProject(sources);
const counts = Object.fromEntries(
  [
    "raw-discrete",
    "gesture-review",
    "unresolved-event",
    "legacy-root",
    "unbound-discrete",
    "non-action",
    "registered-action",
  ].map((kind) => [kind, findings.filter((finding) => finding.kind === kind).length]),
);
const blockingFindings = findings.filter(
  (finding) => !["non-action", "registered-action"].includes(finding.kind),
);
const blocking = blockingFindings.length + unresolvedRuntimeAssertions.length;
const status = blocking ? "OPEN" : "CLOSED_LOCAL_STATIC_CHECKS";
const report = process.argv.indexOf("--report");
if (report >= 0) {
  writeFileSync(
    process.argv[report + 1],
    `${JSON.stringify(
      {
        status,
        counts,
        blocking,
        inputs,
        findings,
        factoryAssociations,
        runtimeAssertions,
        unresolvedRuntimeAssertions,
      },
      null,
      2,
    )}\n`,
  );
}
console.log(JSON.stringify({ status, counts, blocking }));
process.exitCode = blocking ? 1 : 0;
