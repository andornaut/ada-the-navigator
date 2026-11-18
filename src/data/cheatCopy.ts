import type { CheatId } from "../model/cheats.ts";

/** The Cheats modal's strings (gameplay/player-copy.md and gameplay/cheats.md). */
export const CHEAT_COPY = {
  addOre: "Add 1,000 ore",
  addStardust: "Add 1,000 Stardust",
  cancel: "Cancel",
  close: "Close",
  fpsCounter: "FPS counter",
  maxWeaponLevels: "Max weapon levels",
  open: "Open Cheats",
  reset: "Reset",
  resetSave: "Reset save",
  resetSaveTitle: "Reset save?",
  showTipsAgain: "Show tips again",
  title: "Cheats",
  unlockAllEquipment: "Unlock all equipment",
  unlockAllGalaxies: "Unlock all galaxies",
  unlockAllWeapons: "Unlock all weapons",
} as const satisfies Readonly<Record<CheatId, string>> & Readonly<Record<string, string>>;
