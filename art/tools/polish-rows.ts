// The staged switch rows of the art polish set, art/polish-rows.json: each producer owns one
// group and rewrites it whole, so the live manifests and data stay as shipped until the switch.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { json } from "./projection.ts";

const ROWS = fileURLToPath(new URL("../polish-rows.json", import.meta.url));

/** Replaces `group` in the staged rows, keeping groups in name order; reruns are byte-identical. */
export function stageRows(group: string, rows: unknown): void {
  const staged = existsSync(ROWS)
    ? (JSON.parse(readFileSync(ROWS, "utf8")) as Record<string, unknown>)
    : {};
  staged[group] = rows;
  const text = json(
    Object.fromEntries(Object.entries(staged).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
  if (!existsSync(ROWS) || readFileSync(ROWS, "utf8") !== text) writeFileSync(ROWS, text);
}
