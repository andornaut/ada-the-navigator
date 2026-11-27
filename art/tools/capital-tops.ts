import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../../src/data/capitalBosses.ts";
import { enemyGeometryKey, PHANTOM_FLAGSHIP_ID } from "../../src/data/enemyIdentity.ts";
import {
  CAPITAL_PROFILE_SELECTION,
  capitalProfile,
  signatureLoadout,
} from "../../src/data/enemySignatures.ts";
import { ROUTE, ROUTE_POSITION, type RoutePosition } from "../../src/data/galaxies.ts";
import type { EnemyWeapon } from "../../src/data/types.ts";

const bosses: Readonly<Record<RoutePosition, string>> = {
  1: SUNFLOWER_CAPITAL_BOSS.id,
  2: WHIRLPOOL_CAPITAL_BOSS.id,
  3: NEEDLE_CADENCE.id,
  4: ANDROMEDA_REDACT.id,
  5: CARTWHEEL_CLAIM.id,
  6: PHANTOM_FLAGSHIP_ID,
};

export const CAPITAL_TOPS = {
  chargedLance: { top: "lance", aim: "target" },
  mineLayer: { top: "hopper", aim: "aft" },
  scattershot: { top: "spread", aim: "target" },
  laser: { top: "gun", aim: "target" },
  multiLaser: { top: "triple", aim: "target" },
  rapidMissile: { top: "pod", aim: "target" },
  heavyMissile: { top: "rail", aim: "target" },
} as const satisfies Partial<Record<EnemyWeapon, { top: string; aim: "aft" | "target" }>>;

type CapitalWeapon = keyof typeof CAPITAL_TOPS;

function ordinaryWitnesses(position: RoutePosition): string[] {
  const expected = position >= CAPITAL_PROFILE_SELECTION.mineFromPosition ? 2 : 1;
  const witnesses = new Map<ReturnType<typeof capitalProfile>, string>();
  for (let seed = 0; seed < 64 && witnesses.size < expected; seed++) {
    const id = `capital:art-${seed}`;
    witnesses.set(capitalProfile(position, id), id);
  }
  if (witnesses.size !== expected)
    throw new Error(`Capital position ${position} lacks profile witnesses`);
  return [...witnesses.values()];
}

export function fleetCapitalDesign(key: string): string {
  return key[5]!.toLowerCase() + key.slice(6);
}

export function capitalLoadouts(
  design: string,
  fill: readonly string[],
  tiers: readonly (readonly [readonly [number, number], number])[],
) {
  const loadouts: { id: string; weapons: ReadonlyMap<string, EnemyWeapon> }[] = [];
  for (const galaxy of ROUTE) {
    const position = ROUTE_POSITION[galaxy];
    for (const id of [bosses[position], ...ordinaryWitnesses(position)]) {
      if (enemyGeometryKey({ archetype: "capital", id }, position) !== design) continue;
      const tier = tiers.find(([[first, last]]) => position >= first && position <= last);
      if (!tier) throw new Error(`Capital position ${position} lacks an Art mount tier`);
      loadouts.push({
        id,
        weapons: signatureLoadout("capital", position, id, fill.slice(0, tier[1])),
      });
    }
  }
  if (!loadouts.length) throw new Error(`No capital loadouts for ${design}`);
  return loadouts;
}

export function capitalWeaponsByMount(...args: Parameters<typeof capitalLoadouts>) {
  const mounts = new Map<string, Set<CapitalWeapon>>();
  for (const { weapons } of capitalLoadouts(...args)) {
    for (const [mount, weapon] of weapons) {
      if (!Object.hasOwn(CAPITAL_TOPS, weapon)) throw new Error(`No capital top for ${weapon}`);
      if (!mounts.has(mount)) mounts.set(mount, new Set());
      mounts.get(mount)!.add(weapon as CapitalWeapon);
    }
  }
  return mounts;
}

export function capitalWeapons(...args: Parameters<typeof capitalLoadouts>): CapitalWeapon[] {
  const reachable = new Set(
    [...capitalWeaponsByMount(...args).values()].flatMap((weapons) => [...weapons]),
  );
  return (Object.keys(CAPITAL_TOPS) as CapitalWeapon[]).filter((weapon) => reachable.has(weapon));
}
