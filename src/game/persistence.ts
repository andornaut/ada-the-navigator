import { saveStore } from "@andornaut/game-kit/save/saveStore";
import type { SaveFormat } from "@andornaut/game-kit/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import { newGameState } from "../model/game.ts";
import { restoreSave, SAVE_VERSION } from "../model/save.ts";
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

/** One page-session store owns storage, backups and permanent write fences. */
export const saves = saveStore(localSaveStorage(), SAVE_KEYS, SAVE_FORMAT);
