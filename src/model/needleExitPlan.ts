import { encounterTable, type EnemyArchetype } from "../data/enemyCatalog.ts";
import { NEEDLE } from "../data/needle.ts";
import { dropRandom } from "./drops.ts";
import { rollEncounter } from "./encounterRoll.ts";
import type { Vec } from "./types.ts";

/** Authored spawn descriptors are neither active actors nor discovery/quest associations. */
export interface NeedleExitSpawn {
  readonly archetype: EnemyArchetype;
  readonly home: Vec;
  readonly id: string;
  readonly packId: string;
  readonly point: Vec;
}

/** The existing world-seed draw stream and authored exit formation are preserved exactly. */
export function planNeedleExit(seed: number, center: Vec): readonly NeedleExitSpawn[] {
  const next = dropRandom(seed, "needle:exit");
  const pack = rollEncounter(
    encounterTable(4).filter((entry) => entry.archetype === "swarm"),
    next(),
    next(),
  );
  return Array.from({ length: pack.count }, (_, index) => {
    const angle = (index * Math.PI * 2) / pack.count;
    return {
      archetype: pack.archetype,
      home: { x: center.x, y: center.y },
      id: `needle:exit:${index}`,
      packId: "needle:exit",
      point: {
        x: center.x + Math.cos(angle) * NEEDLE.exitPackRadius,
        y: center.y + Math.sin(angle) * NEEDLE.exitPackRadius,
      },
    };
  });
}
