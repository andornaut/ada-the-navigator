import { readSave as readStoredSave, writeSave as writeStoredSave } from "../model/save.ts";

const KEY = "ada-the-navigator.prototype.v1";

export function readSave(): unknown {
  try {
    return readStoredSave(localStorage, KEY);
  } catch {
    return undefined;
  }
}

export function writeSave(saved: string): boolean {
  try {
    return writeStoredSave(localStorage, KEY, saved);
  } catch {
    return false;
  }
}
