import type { Vec } from "../model/types.ts";
import type { SectorId } from "./types.ts";

/**
 * Each galaxy's community projects (gameplay/economy.md "Donations"), by id. A funded id in a
 * galaxy's progress changes that galaxy's world.
 */
export const DONATION_PROJECTS: Readonly<Record<SectorId, readonly string[]>> = {
  1: ["greenhouseRing", "workshopCrane", "salvageBeacons"],
  2: ["dockingBay", "hubRepairs"],
  3: ["nurseryBeacon", "currentBuoys"],
};

export type StoryShipId = "miner" | "visitor-1" | "visitor-2" | "blocker";
export type StorySceneId = "blocked" | "docking";

/** A scripted path: hub-relative points, each reached `at` seconds into the scene. */
export type StoryPath = readonly (Vec & { readonly at: number })[];

export interface StoryScene {
  readonly duration: number;
  /** The dialogue line that follows when the scene ends. */
  readonly line: string;
  readonly paths: Readonly<Partial<Record<StoryShipId, StoryPath>>>;
}

/**
 * Cartwheel's story ships (gameplay/rules.md): the miner, two regular visitors and the
 * blocking pilot. Between scenes the miner and the visitors wait at their hub-relative holding
 * points facing the hub; the miner's and the visitors' holding points are their story
 * destinations, kept two safe radii from the hub and each other. Each scene moves its ships
 * along scripted paths, then its line plays. Ships that dock stay docked. Values are
 * provisional tuning in world units and seconds.
 */
export const CARTWHEEL_STORY_SHIPS: {
  readonly destinations: Readonly<Record<"miner" | "visitors", Vec>>;
  readonly hold: Readonly<Record<Exclude<StoryShipId, "blocker">, Vec>>;
  readonly scenes: Readonly<Record<StorySceneId, StoryScene>>;
  readonly sector: SectorId;
} = {
  destinations: {
    miner: { x: -340, y: 160 },
    visitors: { x: 300, y: 240 },
  },
  hold: {
    miner: { x: -340, y: 160 },
    "visitor-1": { x: 250, y: 270 },
    "visitor-2": { x: 350, y: 210 },
  },
  scenes: {
    // The blocking pilot cuts across the miner's approach and the miner turns away.
    blocked: {
      duration: 8,
      line: "firstDeposit",
      paths: {
        blocker: [
          { at: 0, x: 360, y: -420 },
          { at: 3, x: -120, y: 100 },
          { at: 5, x: -420, y: 400 },
          { at: 8, x: -900, y: 800 },
        ],
        miner: [
          { at: 0, x: -340, y: 160 },
          { at: 2.6, x: -150, y: 70 },
          { at: 3.4, x: -190, y: 120 },
          { at: 8, x: -340, y: 160 },
        ],
      },
    },
    // The visitors join the miner, the three fly in together and dock; the blocking pilot
    // flies off.
    docking: {
      duration: 10,
      line: "approach",
      paths: {
        blocker: [
          { at: 0, x: 240, y: -200 },
          { at: 2, x: 300, y: -260 },
          { at: 10, x: 1300, y: -900 },
        ],
        miner: [
          { at: 0, x: -340, y: 160 },
          { at: 3, x: -340, y: 160 },
          { at: 8.5, x: -40, y: 30 },
        ],
        "visitor-1": [
          { at: 0, x: 250, y: 270 },
          { at: 3, x: -360, y: 110 },
          { at: 8.5, x: -60, y: 10 },
        ],
        "visitor-2": [
          { at: 0, x: 350, y: 210 },
          { at: 3, x: -310, y: 220 },
          { at: 8.5, x: -20, y: 60 },
        ],
      },
    },
  },
  sector: 2,
};
