import { type SaveStore, saveStore } from "@andornaut/game-kit/runtime/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/runtime/save/storage";
import { encodeSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";

import { newGameState } from "../model/game.ts";
import { restoreSave, SAVE_VERSION } from "../model/save.ts";
import { inspectAdaSave, preV1SaveResetAllowed } from "../model/saveIntegrity.ts";
import type { GameSave } from "../model/types.ts";

export const SAVE_KEYS = {
  backup: "ada-the-navigator.save.backup",
  save: "ada-the-navigator.save",
} as const;

export const SAVE_FORMAT: SaveFormat<GameSave> = {
  decode(stored) {
    const save = restoreSave(stored);
    return save
      ? { ok: true, value: save }
      : { ok: false, reason: "The stored Ada save is invalid" };
  },
  encode(save) {
    return save.version === SAVE_VERSION
      ? { ok: true, value: { ...save } }
      : { ok: false, reason: "The Ada save format is invalid" };
  },
  fresh: newGameState,
  migrations: {},
  version: SAVE_VERSION,
};

/** Repair only Ada save data while the application is pre-v1; the Kit keeps every store fence. */
export function createAdaSaves(
  storage: SaveStorage,
  applicationVersion?: string,
): SaveStore<GameSave> {
  if (!preV1SaveResetAllowed(applicationVersion)) {
    return saveStore(storage, SAVE_KEYS, SAVE_FORMAT);
  }
  // CLEANUP (added 2026-11-15): Remove pre-v1 repair when application releases reach version 1.
  let blocked: string | null = null;
  const admitRepair = () => {
    if (blocked !== null) {
      throw new Error(blocked);
    }
  };
  const store = saveStore(
    {
      async read(key) {
        try {
          const raw = await storage.read(key);
          if (key !== SAVE_KEYS.save) {
            return raw;
          }
          const inspected = inspectAdaSave(raw);
          if (inspected.status === "new") {
            return null;
          }
          const encoded = encodeSave(
            SAVE_FORMAT,
            inspected.status === "valid" ? inspected.save : newGameState(),
          );
          if (!encoded.ok) {
            throw new Error(encoded.reason);
          }
          if (inspected.status === "issue") {
            admitRepair();
            await storage.write(SAVE_KEYS.backup, raw!);
            admitRepair();
            await storage.write(SAVE_KEYS.save, encoded.value);
          }
          // The model's supported migration is normalized for the Kit, without rewriting valid data.
          return encoded.value;
        } catch (error) {
          blocked ??= "storage was unavailable at load";
          throw error;
        }
      },
      write: (key, value) => storage.write(key, value),
    },
    SAVE_KEYS,
    SAVE_FORMAT,
  );
  return {
    blockWrites(reason) {
      blocked ??= reason;
      store.blockWrites(reason);
    },
    load: () => store.load(),
    save: (value) => store.save(value),
  };
}

/** One page-session store owns storage, backups and permanent write fences. */
export const saves = createAdaSaves(localSaveStorage());
