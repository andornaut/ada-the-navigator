import {
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  type FireProfile,
} from "./enemyCatalog.ts";

/** One hardpoint in the export Art's generator reads to anchor parts on each heading. */
export interface ExportedHardpoint {
  fire?: FireProfile["projectile"];
  id: string;
  /** Fraction of hull width in the hull's local frame: `-y` forward, `+x` starboard. */
  offset: [number, number];
  order: number;
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

/**
 * The catalog's hardpoint layouts and Art's mounts in the shape of `tools/enemy-hardpoints.json`:
 * each archetype's hardpoints, then its weapon mounts the catalog does not list as hardpoints yet
 * in fill order at Art's offsets (art/heavies.md "Layout and the catalog"), then Art-only mounts.
 */
export function exportHardpoints(): {
  archetypes: Record<string, { hardpoints: ExportedHardpoint[]; sizeRatio: number }>;
  version: 1;
} {
  return {
    archetypes: Object.fromEntries(
      HARDPOINT_ARCHETYPES.map((archetype) => {
        const definition: EnemyDefinition = enemyCatalog[archetype];
        const hardpoints: ExportedHardpoint[] = definition.hardpoints.map((part, order) => ({
          ...(part.kind === "weapon" ? { fire: part.fire.projectile } : {}),
          id: part.id,
          offset: [part.offset.x, part.offset.y],
          order,
          role: part.kind === "weapon" ? "turret" : part.kind,
        }));
        const unlisted = (definition.mounts?.fill ?? []).filter(
          (id) => !hardpoints.some((part) => part.id === id),
        );
        const parts: ExportedHardpoint[] = [
          ...hardpoints,
          ...unlisted.map((id, index) => {
            const offset = definition.mounts!.offsets[id]!;
            return {
              id,
              offset: [offset.x, offset.y] as [number, number],
              order: hardpoints.length + index,
              role: "turret" as const,
            };
          }),
        ];
        const mounts: ExportedHardpoint[] = (MOUNTS[archetype] ?? []).map((mount, index) => ({
          fire: definition.fire.projectile,
          id: mount.id,
          offset: [...mount.offset],
          order: parts.length + index,
          role: "turret",
        }));
        return [archetype, { hardpoints: [...parts, ...mounts], sizeRatio: definition.sizeRatio }];
      }),
    ),
    version: 1,
  };
}
