import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { scanDiscreteActionBindings } from "../src/testing/discreteActionArchitecture.ts";

const root = process.cwd();
const findings = [];
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      findings.push(
        ...scanDiscreteActionBindings(relative(root, file), readFileSync(file, "utf8")),
      );
    }
  }
}
inspect(join(root, "src"));
const counts = Object.fromEntries(
  ["raw-discrete", "gesture-review", "unresolved-event", "legacy-root"].map((kind) => [
    kind,
    findings.filter((finding) => finding.kind === kind).length,
  ]),
);
const report = process.argv.indexOf("--report");
if (report >= 0) {
  writeFileSync(process.argv[report + 1], `${JSON.stringify({ counts, findings }, null, 2)}\n`);
}
console.log(JSON.stringify(counts));
process.exitCode = findings.some((finding) => finding.kind !== "gesture-review") ? 1 : 0;
