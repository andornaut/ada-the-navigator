import type { UpgradeTrack } from "./economy.ts";

export const EQUIPMENT_DESCRIPTIONS = {
  engine: "Raises your top speed and helps you accelerate and turn faster.",
  shield: "Absorbs damage and recharges after a quiet stretch.",
  tractor: "Pulls nearby pickups toward your ship.",
} as const satisfies Readonly<Record<UpgradeTrack, string>>;
