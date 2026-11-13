import type { Weapon } from "./types.ts";
import { weaponAt } from "./weaponCatalog.ts";

/** Approved weapon card lines, with counts from the current weapon definition. */
export const WEAPON_DETAIL_LINES = {
  heavyMissile: [
    "Fires slowly but hits hard.",
    "Explodes on a hit or after a short distance, with a big blast.",
    "Each level hits harder.",
  ],
  laser: ["Fires one laser bolt at a time.", "Each level fires faster and hits harder."],
  multiLaser: [
    "Fires a fan of {count} laser bolts.",
    "Hits several drones at once.",
    "Each level adds a bolt.",
  ],
  phaser: [
    "Fires an instant beam that nothing can dodge.",
    "Fires slowly but hits hard.",
    "Each level hits harder.",
  ],
  rapidMissile: [
    "Fires small missiles quickly.",
    "Explodes on a hit or after a short distance.",
    "Each level fires faster.",
  ],
  scattershot: [
    "Fires a wide spread of {count} shots.",
    "Only reaches close to your ship.",
    "Each level adds shots that hit harder.",
  ],
} as const satisfies Readonly<Record<Weapon, readonly string[]>>;

export const WEAPON_DETAIL_LABELS = {
  detailAmmoLeft: "Ammo: {count} left",
  detailIncludesAmmo: "Comes with 3 ammo packs.",
  detailUnlimited: "Never runs out.",
} as const;

export function weaponDetailLines(weapon: Weapon, level: number): readonly string[] {
  const count = String(weaponAt(weapon, level).anglesDegrees.length);
  return WEAPON_DETAIL_LINES[weapon].map((line) => line.replace("{count}", count));
}
