import type { SectorProgress } from "./types.ts";

/** A galaxy's progress before Ada first flies there. */
export function newProgress(): SectorProgress {
  return {
    charted: [],
    deposited: 0,
    disabledEnemies: 0,
    discoveries: 0,
    donated: {},
    explored: [],
    greetings: {},
    holodisk: false,
    introduced: false,
    known: [],
    opened: false,
    questComplete: false,
    questItem: null,
    resolved: false,
    revealed: [],
    stage: 0,
    stations: [],
  };
}
