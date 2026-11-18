import { HOSTILE_STATION_SIGNATURE } from "../../src/data/enemySignatures.ts";
import { coral, coralRear, coralSide, insignia, plate } from "./crafts.ts";
import { ADA_MODEL_SPAN, normalizeHeavy, partPoints } from "./enemy-size.ts";
import { capital, type HeavyCraft, ring, STATION_FILL, STATION_TIERS, weapons } from "./heavies.ts";

/** The reviewed physical assembly, before its canonical intact-body normalization. */
export function hostileStationSource(): HeavyCraft {
  const capitalMounts = capital.hardpoints.filter(({ model }) => model.role === "turret");
  const source = capitalMounts.find(({ model }) => model.capped)!.model;
  const baseRadius = Math.max(...partPoints(source.intact).map(([x, y]) => Math.hypot(x, y)));
  const radius = Math.max(
    ...capitalMounts.map(
      ({ offset }) => Math.hypot(...offset) * capital.sizeRatio * ADA_MODEL_SPAN,
    ),
  );
  const outer = (radius + baseRadius) / Math.cos(Math.PI / 16);
  const deck = Math.min(...source.intact.map(({ z0 }) => z0));
  const pool = weapons(deck, [
    HOSTILE_STATION_SIGNATURE.remaining,
    HOSTILE_STATION_SIGNATURE.special.weapon,
  ]);
  return {
    name: "hostileStation",
    title: "Hostile station",
    frame: 360,
    source: "heavies",
    fixed: true,
    hullTop: deck,
    // Fractions reconstruct reviewed physical origins in the capital model's existing units.
    sizeRatio: capital.sizeRatio,
    hull: [
      {
        plan: ring(0, 0, outer, 16, Math.PI / 16),
        z0: 0,
        z1: deck,
        top: coral,
        side: coralSide,
        rear: coralRear,
      },
      {
        plan: ring(0, 0, outer * 0.71, 16, Math.PI / 16),
        z0: deck,
        z1: deck + 2,
        top: coralRear,
        side: coralSide,
      },
      {
        plan: ring(0, 0, outer * 0.32, 8),
        z0: deck + 2,
        z1: deck + 4,
        top: plate,
        side: coralSide,
      },
      ...insignia(0, 0, baseRadius * 1.4, deck + 4),
    ],
    hardpoints: STATION_FILL.map((id, index) => {
      const angle = (index * Math.PI) / 4;
      const kind =
        id === HOSTILE_STATION_SIGNATURE.special.mount
          ? HOSTILE_STATION_SIGNATURE.special.weapon
          : HOSTILE_STATION_SIGNATURE.remaining;
      return {
        id,
        offset: [
          (radius * Math.cos(angle)) / (capital.sizeRatio * ADA_MODEL_SPAN),
          (radius * Math.sin(angle)) / (capital.sizeRatio * ADA_MODEL_SPAN),
        ],
        model: { ...source, top: pool[kind]!.top },
      };
    }),
    mounts: { fill: STATION_FILL, tiers: STATION_TIERS, weapons: pool },
  };
}

export function hostileStation(): HeavyCraft {
  return normalizeHeavy(hostileStationSource());
}
