import { CONTENT } from "./content.ts";
import type { EnemyDefinition, FireProfile, WeaponMounts } from "./enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "./enemyDimensions.ts";
import { enemyGeometryKey } from "./enemyIdentity.ts";
import { ENEMY_DISPLAY_SCALE, MUZZLE_ART } from "./enemyMuzzles.ts";
import {
  HOSTILE_STATION_SIGNATURE,
  hostileStationHullHp,
  hostileStationSignatureTiers,
} from "./enemySignatures.ts";
import { ROUTE_POSITION } from "./galaxies.ts";
import type { EnemyWeapon, GalaxyNumber, WeaponLevel } from "./types.ts";

const profiles = new Map<string, EnemyDefinition>();

export interface HostileStationProfileContext {
  readonly base: EnemyDefinition;
  readonly fire: (weapon: EnemyWeapon) => FireProfile;
  readonly partHp: number;
}

/** Immobile stations use phased weapon clocks and their route-position mount tier. */
export function hostileStationDefinition(
  context: HostileStationProfileContext,
  subject: { readonly galaxy: GalaxyNumber; readonly weaponLevel: WeaponLevel },
): EnemyDefinition {
  const { galaxy, weaponLevel } = subject;
  const position = ROUTE_POSITION[galaxy];
  const hp = hostileStationHullHp(context.partHp, position);
  if (hp === undefined) {
    throw new RangeError("Unsupported hostile-station route position");
  }
  const key = `${galaxy}:${weaponLevel}`;
  const cached = profiles.get(key);
  if (cached) {
    return cached;
  }
  const signature = HOSTILE_STATION_SIGNATURE;
  const assetKey = enemyGeometryKey({ archetype: "hostileStation" }, position);
  const art = MUZZLE_ART[assetKey]!;
  const sizeRatio = ENEMY_SIZE_RATIOS.hostileStation;
  const width = sizeRatio * CONTENT.tuning.flight.shipRadius * 2;
  const offsets = Object.fromEntries(
    signature.fill.map((id) => {
      const anchor = art.anchors.get(id)![0]!;
      // Heading zero faces world +x; invert projection, then express the anchor in local axes.
      return [
        id,
        {
          x: ((anchor.y - anchor.x / 2) * ENEMY_DISPLAY_SCALE) / width,
          y: (-(anchor.y + anchor.x / 2) * ENEMY_DISPLAY_SCALE) / width,
        },
      ];
    }),
  );
  const weapon = (id: string) =>
    id === signature.special.mount ? signature.special.weapon : signature.remaining;
  const mounts: WeaponMounts = {
    fill: signature.fill,
    offsets,
    tiers: hostileStationSignatureTiers().map((tier) => ({
      mounts: Object.fromEntries(
        signature.fill.map((id) => [id, tier.mounts[id] ? { level: 1, weapon: weapon(id) } : null]),
      ),
      positions: tier.positions,
    })),
  };
  const tier = mounts.tiers.find(({ positions }) => positions[0] === position)!;
  const fire = (id: string) => context.fire(weapon(id));
  const definition: EnemyDefinition = {
    ...context.base,
    assetKey,
    fire: fire(signature.fill[0]),
    fireClockPolicy: "staggered-and-paused",
    hardpoints: signature.fill.flatMap((id) =>
      tier.mounts[id]
        ? [
            {
              fire: fire(id),
              hp: context.partHp,
              id,
              kind: "weapon" as const,
              offset: offsets[id]!,
            },
          ]
        : [],
    ),
    hp,
    mounts,
    sizeRatio,
  };
  profiles.set(key, definition);
  return definition;
}
