/** A station's specialized offers. Exchange remains available at every station. */
export type StationService = "equipment" | "weaponsAmmo" | "jobs";

/** Authoritative docked-station capabilities, including existing task access. */
export interface StationServices {
  readonly exchange: true;
  readonly equipment: boolean;
  readonly weaponsAmmo: boolean;
  readonly jobs: boolean;
  readonly projects: boolean;
  readonly heldTask: boolean;
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
