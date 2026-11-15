/** Approved hostile geographic sites; combat admission remains a separate caller policy. */
export const HOSTILE_STATION_PLACEMENT = {
  densityArea: 625_000_000,
  galaxies: ["andromeda", "cartwheel", "phantom"],
  maximumCenterDistance: 100_000,
  minimumCenterDistance: 10_000,
} as const;
