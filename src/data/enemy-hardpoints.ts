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

/** Archetypes whose sprites carry hardpoints. */
export const HARDPOINT_ARCHETYPES = ["frigate", "capital"] as const satisfies EnemyArchetype[];

/** The catalog's hardpoint layouts in the shape of `tools/enemy-hardpoints.json`. */
export function exportHardpoints(): {
  archetypes: Record<string, { hardpoints: ExportedHardpoint[]; sizeRatio: number }>;
  version: 1;
} {
  return {
    archetypes: Object.fromEntries(
      HARDPOINT_ARCHETYPES.map((archetype) => {
        const definition = enemyCatalog[archetype];
        return [
          archetype,
          {
            hardpoints: definition.hardpoints.map((part, order) => ({
              ...(part.kind === "weapon" ? { fire: part.fire.projectile } : {}),
              id: part.id,
              offset: [part.offset.x, part.offset.y],
              order,
              required: part.required,
              role: part.kind === "weapon" ? "turret" : part.kind,
            })),
            sizeRatio: definition.sizeRatio,
          },
        ];
      }),
    ),
    version: 1,
  };
}
