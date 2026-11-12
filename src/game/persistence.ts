import { readSave as readStoredSave, writeSave as writeStoredSave } from "../model/save.ts";

const KEY = "ada-the-navigator.save";

// Cleared by a crash (src/main.ts): the game's state may be corrupt, so the last save stands.
let saving = true;

/** Writes nothing more for the rest of this page's life; later writes report success. */
export function stopSaving(): void {
  saving = false;
}

export function readSave(): unknown {
  try {
    return readStoredSave(localStorage, KEY);
  } catch {
    return undefined;
  }
}

export function writeSave(saved: string): boolean {
  if (!saving) {
    return true;
  }
  try {
    return writeStoredSave(localStorage, KEY, saved);
  } catch {
    return false;
  }
}
