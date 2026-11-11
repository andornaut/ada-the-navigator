import { type EnemyArchetype, enemyCatalog } from "./enemy-catalog.ts";

/** One hardpoint in the export Art's generator reads to anchor parts on each heading. */
export interface ExportedHardpoint {
  fire?: "bolt" | "missile";
  id: string;
  /** Fraction of hull width in the hull's local frame: `-y` forward, `+x` starboard. */
  offset: [number, number];
  order: number;
  required: boolean;
  role: "command" | "engine" | "turret";
}

/** Archetypes whose sprites carry hardpoints or mounts. */
export const HARDPOINT_ARCHETYPES = [
  "frigate",
  "capital",
  "retaliator",
  "platform",
] as const satisfies EnemyArchetype[];

/**
 * Art-only turret mounts on ships without parts: an anchor for the aimed gun's sprite, not a
 * hardpoint the model damages or requires. The retaliator's three barrels pivot on its hull
 * origin.
 */
const MOUNTS: Partial<Record<EnemyArchetype, readonly { id: string; offset: [number, number] }[]>> =
  {
    retaliator: [{ id: "turret", offset: [0, 0] }],
  };

/** The catalog's hardpoint layouts and Art's mounts in the shape of `tools/enemy-hardpoints.json`. */
export function exportHardpoints(): {
  archetypes: Record<string, { hardpoints: ExportedHardpoint[]; sizeRatio: number }>;
  version: 1;
} {
  return {
    archetypes: Object.fromEntries(
      HARDPOINT_ARCHETYPES.map((archetype) => {
        const definition = enemyCatalog[archetype];
        const parts: ExportedHardpoint[] = definition.hardpoints.map((part, order) => ({
          ...(part.kind === "weapon" ? { fire: part.fire.projectile } : {}),
          id: part.id,
          offset: [part.offset.x, part.offset.y],
          order,
          required: part.required,
          role: part.kind === "weapon" ? "turret" : part.kind,
        }));
        const mounts: ExportedHardpoint[] = (MOUNTS[archetype] ?? []).map((mount, index) => ({
          fire: definition.fire.projectile,
          id: mount.id,
          offset: [...mount.offset],
          order: parts.length + index,
          required: false,
          role: "turret",
        }));
        return [archetype, { hardpoints: [...parts, ...mounts], sizeRatio: definition.sizeRatio }];
      }),
    ),
    version: 1,
  };
}
