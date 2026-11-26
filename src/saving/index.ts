import { type SaveStore, saveStore } from "@andornaut/game-kit/runtime/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/runtime/save/storage";
import { encodeSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";

import { newGameState } from "../model/game.ts";
import { SAVE_VERSION } from "../model/saveSchema.ts";
import type { GameSave } from "../model/types.ts";
import { restoreSave } from "./codec.ts";
import { inspectAdaSave, preV1SaveResetAllowed } from "./integrity.ts";

export { SAVE_VERSION } from "../model/saveSchema.ts";
export { restoreGameSave, restoreSave, SAVE_RESTORE } from "./codec.ts";
export { type AdaSaveInspection, inspectAdaSave, preV1SaveResetAllowed } from "./integrity.ts";

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

interface CampaignStorage {
  readonly available?: () => boolean;
  readonly lock: <T>(operation: () => T | Promise<T>) => Promise<T>;
}

interface SaveStamp {
  readonly generation: string | null;
  readonly revision: string;
}

function saveStamp(value: unknown): SaveStamp | null {
  if (value === undefined) {
    return null;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("generation" in value) ||
    (value.generation !== null && (typeof value.generation !== "string" || !value.generation)) ||
    !("revision" in value) ||
    typeof value.revision !== "string" ||
    !value.revision
  ) {
    throw new Error("The Ada save revision is invalid");
  }
  return { generation: value.generation, revision: value.revision };
}

function storedRecord(raw: string | null): { adaSaveStamp?: unknown; version?: unknown } | null {
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null; // The existing pre-v1 repair path handles invalid game data.
  }
}

function stampSave(raw: string, stamp: SaveStamp | null): string {
  const save = JSON.parse(raw) as { adaSaveStamp?: SaveStamp };
  if (stamp) {
    save.adaSaveStamp = stamp;
  } else {
    delete save.adaSaveStamp;
  }
  return JSON.stringify(save);
}

export interface CampaignSave {
  readonly raw: string;
  readonly save: GameSave;
}

interface AdaSaves extends SaveStore<GameSave> {
  load(options?: { readonly bindModel?: boolean }): ReturnType<SaveStore<GameSave>["load"]>;
  readCampaign(): Promise<CampaignSave | null>;
  commitCampaign(
    authorized: CampaignSave,
    next: GameSave,
    current: () => boolean,
  ): Promise<(() => void) | null>;
}

/** Repair only Ada save data while the application is pre-v1; the Kit keeps every store fence. */
export function createAdaSaves(
  storage: SaveStorage,
  applicationVersion?: string,
  campaign?: CampaignStorage,
): AdaSaves {
  const repairs = preV1SaveResetAllowed(applicationVersion);
  // CLEANUP (added 2026-11-15): Remove pre-v1 repair when application releases reach version 1.
  let blocked: string | null = null;
  let modelGeneration: string | null = null;
  const decodedStamps = new WeakMap<GameSave, SaveStamp>();
  const participating = () => campaign !== undefined && campaign.available?.() !== false;
  const access = <T>(operation: () => Promise<T>) =>
    campaign ? campaign.lock(operation) : operation();
  const checkWriteFence = () => {
    if (blocked !== null) {
      throw new Error(blocked);
    }
  };
  const newerStamp = (generation: string | null): SaveStamp => ({
    generation,
    revision: crypto.randomUUID(),
  });
  async function readPlayableSave(): Promise<CampaignSave | null> {
    if (blocked !== null) {
      return null;
    }
    try {
      return await access(async () => {
        const raw = await storage.read(SAVE_KEYS.save);
        if (
          raw === null ||
          blocked !== null ||
          (participating() &&
            (saveStamp(storedRecord(raw)?.adaSaveStamp)?.generation ?? null) !== modelGeneration)
        ) {
          return null;
        }
        const inspected = inspectAdaSave(raw);
        if (inspected.status !== "valid") {
          return null;
        }
        const save = inspected.save as GameSave & { adaSaveStamp?: unknown };
        delete save.adaSaveStamp;
        return save.started || save.pendingStory || save.prologueSeen ? { raw, save } : null;
      });
    } catch {
      return null;
    }
  }
  const store = saveStore(
    {
      async read(key) {
        try {
          return await access(async () => {
            const raw = await storage.read(key);
            if (key !== SAVE_KEYS.save) {
              return raw;
            }
            const stored = storedRecord(raw);
            if (!repairs) {
              // Let the Kit keep its newer-save policy before interpreting Ada metadata.
              if (stored?.version === SAVE_VERSION) {
                saveStamp(stored.adaSaveStamp);
              }
              return raw;
            }
            const stamp = saveStamp(stored?.adaSaveStamp);
            const inspected = inspectAdaSave(raw);
            if (inspected.status === "new") {
              return null;
            }
            // Strip storage metadata when encoding the normalized model for Kit validation.
            const encoded = encodeSave(
              SAVE_FORMAT,
              inspected.status === "valid" ? inspected.save : newGameState(),
            );
            if (!encoded.ok) {
              throw new Error(encoded.reason);
            }
            if (inspected.status === "issue") {
              // The original read and both repair writes use the same lock as rewind.
              checkWriteFence();
              await storage.write(SAVE_KEYS.backup, raw!);
              const generation =
                participating() &&
                typeof stored?.version === "number" &&
                Number.isSafeInteger(stored.version) &&
                stored.version < SAVE_VERSION
                  ? crypto.randomUUID()
                  : (stamp?.generation ?? null);
              const repaired = stampSave(
                encoded.value,
                participating() ? newerStamp(generation) : stamp,
              );
              checkWriteFence();
              await storage.write(SAVE_KEYS.save, repaired);
              return repaired;
            }
            return stampSave(encoded.value, stamp);
          });
        } catch (error) {
          blocked ??= "storage was unavailable at load";
          throw error;
        }
      },
      write(key, value) {
        // Capture admission before queuing. A model installed while this write waits cannot
        // lend its generation to the older snapshot.
        const admittedGeneration = modelGeneration;
        return access(async () => {
          checkWriteFence();
          if (key !== SAVE_KEYS.save || !participating()) {
            return storage.write(key, value);
          }
          const stored = storedRecord(await storage.read(key));
          const stamp = saveStamp(stored?.adaSaveStamp);
          checkWriteFence();
          if ((stamp?.generation ?? null) !== admittedGeneration) {
            throw new Error("The campaign was rewound in another tab. Reload to resume saving.");
          }
          if (stored) {
            delete stored.adaSaveStamp;
            if (JSON.stringify(stored) === value) {
              return undefined; // Preserve the bytes and revision for an identical save.
            }
          }
          return storage.write(key, stampSave(value, newerStamp(admittedGeneration)));
        });
      },
    },
    SAVE_KEYS,
    {
      ...SAVE_FORMAT,
      decode({ adaSaveStamp, ...data }) {
        const result = SAVE_FORMAT.decode(data);
        if (result.ok) {
          const stamp = saveStamp(adaSaveStamp);
          if (stamp) {
            decodedStamps.set(result.value, stamp);
          }
        }
        return result;
      },
    },
  );
  return {
    blockWrites(reason) {
      blocked ??= reason;
      store.blockWrites(reason);
    },
    async commitCampaign(authorized, next, current) {
      if (!participating() || blocked !== null || !current()) {
        return null;
      }
      const encoded = encodeSave(SAVE_FORMAT, next);
      if (!encoded.ok || inspectAdaSave(encoded.value).status !== "valid") {
        return null;
      }
      try {
        return await access(async () => {
          const raw = await storage.read(SAVE_KEYS.save);
          if (
            blocked !== null ||
            !current() ||
            raw !== authorized.raw ||
            (saveStamp(storedRecord(raw)?.adaSaveStamp)?.generation ?? null) !== modelGeneration
          ) {
            return null;
          }
          // The exact comparison includes the write revision, even for identical game data.
          const generation = crypto.randomUUID();
          await storage.write(SAVE_KEYS.save, stampSave(encoded.value, newerStamp(generation)));
          // Only the scene installing this model may adopt its new generation.
          return () => {
            modelGeneration = generation;
          };
        });
      } catch {
        return null;
      }
    },
    async load({ bindModel = true } = {}) {
      const loaded = await store.load();
      if (loaded.status === "unavailable" || loaded.status === "newer") {
        blocked ??= loaded.reason;
      } else if (bindModel) {
        modelGeneration = decodedStamps.get(loaded.save)?.generation ?? null;
      }
      return loaded;
    },
    async readCampaign() {
      return participating() ? readPlayableSave() : null;
    },
    save: (value) => store.save(value),
  };
}

const browserStorage = localSaveStorage();

/** Serialize Ada's writes with the rewind compare-and-replace across this origin's tabs. */
async function withSaveLock<T>(write: () => T | Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(SAVE_KEYS.save, write) : write();
}

/** One page-session store owns storage, backups and permanent write fences. */
export const saves = createAdaSaves(browserStorage, undefined, {
  available: () => Boolean(navigator.locks),
  lock: withSaveLock,
});
