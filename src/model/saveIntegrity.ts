import packageInfo from "../../package.json";
import { restoreSave } from "./save.ts";
import type { GameState } from "./types.ts";

export type AdaSaveInspection =
  | { status: "new" }
  | { status: "valid"; save: GameState }
  | { status: "issue"; problem: "invalid-save" };

/** Save repair is limited to application releases before version 1. */
export function preV1SaveResetAllowed(applicationVersion = packageInfo.version): boolean {
  return /^0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    applicationVersion,
  );
}

/** Inspect raw Ada data before a storage adapter applies its newer-save fence. */
export function inspectAdaSave(raw: string | null): AdaSaveInspection {
  if (raw === null) {
    return { status: "new" };
  }
  const save = restoreSave(raw);
  return save ? { save, status: "valid" } : { problem: "invalid-save", status: "issue" };
}
