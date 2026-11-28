/** A station's specialized offers. Exchange remains available at every station. */
export type StationService = "equipment" | "weaponsAmmo" | "jobs";
export type StationStockCategory = "weapons" | "equipment" | "ammo";

/** Authoritative docked-station capabilities, including existing task access. */
export interface StationServices {
  readonly exchange: true;
  readonly equipment: boolean;
  readonly weaponsAmmo: boolean;
  readonly jobs: boolean;
  readonly projects: boolean;
  readonly heldTask: boolean;
}

export function stationShopSeed(id: string): number {
  let seed = 0;
  for (let offset = 0; offset < id.length; offset++) {
    seed = (Math.imul(seed, 31) + id.charCodeAt(offset)) >>> 0;
  }
  return seed;
}

/** Keep armories together and retain Equipment at outfitting and named stations. */
export function stationShopCategories(
  services: StationServices,
  id: string,
): readonly [StationStockCategory, StationStockCategory] | undefined {
  if (services.equipment) {
    return stationShopSeed(id) % 2 === 0 ? ["weapons", "equipment"] : ["equipment", "ammo"];
  }
  return services.weaponsAmmo ? ["weapons", "ammo"] : undefined;
}

/** Coordinate assignment stays stable when nearby stations are added or discovered. */
export function stationSpecialty(galaxy: number, id: string): StationService | null {
  const match = /^station:(?:infill:)?(-?\d+),(-?\d+)$/.exec(id);
  if (!match) {
    return null;
  }
  const value = BigInt(match[1]!) + 2n * BigInt(match[2]!) + BigInt(galaxy);
  const index = Number(((value % 3n) + 3n) % 3n);
  return (["equipment", "weaponsAmmo", "jobs"] as const)[index]!;
}
