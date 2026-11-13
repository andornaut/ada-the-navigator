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
