const KEY = "ada-the-navigator.prototype.v1";

export function readSave(): unknown {
  try {
    return readStoredSave(localStorage, KEY);
  } catch {
    return undefined;
  }
}

export function writeSave(saved: string): void {
  try {
    writeStoredSave(localStorage, KEY, saved);
  } catch {
    // Flight remains playable when browser storage is unavailable.
  }
}
import { readSave as readStoredSave, writeSave as writeStoredSave } from "../model/save.ts";
