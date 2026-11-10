const KEY = "ada-the-navigator.prototype.v1";

export function readSave(): unknown {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === null ? undefined : JSON.parse(saved);
  } catch {
    return undefined;
  }
}

export function writeSave(saved: string): void {
  try {
    localStorage.setItem(KEY, saved);
  } catch {
    // Flight remains playable when browser storage is unavailable.
  }
}
