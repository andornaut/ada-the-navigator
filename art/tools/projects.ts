// public/art/projects.json, shared by every generator with world changes: each replaces only its
// own projects, in place, and appends new ones, so reruns in any order leave the file byte-identical.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { json } from "./projection.ts";

const path = fileURLToPath(new URL("../../public/art/projects.json", import.meta.url));
const REVEAL = { durationMs: 600, easing: "cubicOut" } as const;

export function writeProjects(owned: Readonly<Record<string, unknown>>) {
  const current = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as { projects?: Record<string, unknown> })
    : {};
  const projects: Record<string, unknown> = { ...current.projects };
  for (const [id, project] of Object.entries(owned)) {
    projects[id] = project;
  }
  const text = json({ version: 1, reveal: REVEAL, projects });
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
    writeFileSync(path, text);
  }
}
