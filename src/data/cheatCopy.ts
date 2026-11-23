import type { CheatId } from "../model/cheats.ts";

/** The Cheats modal's strings (gameplay/player-copy.md and gameplay/cheats.md). */
export const CHEAT_COPY = {
  addOre: "Add 1,000 ore",
  addStardust: "Add 1,000 Stardust",
  amount: "+1,000",
  back: "Back",
  cancel: "Cancel",
  close: "Close",
  maxWeaponLevels: "Maximize weapon levels",
  reset: "Reset",
  selectiveReset: "Reset jobs, projects & quests",
  selectiveResetBody:
    "Start the story again in Sunflower. This clears your jobs, project funding and quest progress. " +
    "You keep your ship, currency, and map discoveries.",
  selectiveResetTitle: "Reset jobs, projects & quests?",
  title: "Cheats",
  unlockAllEquipment: "Unlock all equipment",
  unlockAllGalaxies: "Unlock all galaxies",
  unlockAllWeapons: "Unlock all weapons",
} as const satisfies Readonly<Record<CheatId, string>> & Readonly<Record<string, string>>;
