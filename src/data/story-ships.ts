import type { Vec } from "../model/types.ts";
import { SCREEN } from "./screen.ts";
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
 * Where story ships may stand while Ada is docked at the hub: the view's half-extents in game
 * area units, less a margin for the HUD and the touch controls and a ship's projected reach.
 * A world offset (x, y) from the hub draws at (x - y, (x + y) / 2), so a ship's reach in world
 * units spans at most sqrt 2 of it across and sqrt 1/2 of it down.
 */
export const STORY_VIEW = (() => {
  const margin = 40;
  /** World units from a ship's centre to its farthest drawn point, the jet's end. */
  const shipReach = 18;
  return {
    halfHeight: SCREEN.height / 2 - margin - shipReach * Math.SQRT1_2,
    halfWidth: SCREEN.width / 2 - margin - shipReach * Math.SQRT2,
    margin,
    shipReach,
  };
})();

/** The hub-relative world offset drawn at a fraction of the docked view's half-extents. */
function inView(across: number, down: number): Vec {
  const x = across * STORY_VIEW.halfWidth;
  const y = down * STORY_VIEW.halfHeight;
  return { x: x / 2 + y, y: y - x / 2 };
}

const MINER = inView(-0.85, -0.4);
const VISITOR_1 = inView(0.8, 0.55);
const VISITOR_2 = inView(0.95, 0.25);

/**
 * Cartwheel's story ships (gameplay/rules.md): the miner, two regular visitors and the
 * blocking pilot. Between scenes the miner and the visitors wait at hub-relative holding
 * points inside the docked view, facing the hub; the miner's point and the visitors' midpoint
 * are their story destinations, outside the hub's safe area and two safe areas apart. Each
 * scene moves its ships along scripted paths, then its line plays. Ships that dock stay docked.
 * Values are provisional tuning in world units and seconds.
 */
export const CARTWHEEL_STORY_SHIPS: {
  readonly destinations: Readonly<Record<"miner" | "visitors", Vec>>;
  readonly hold: Readonly<Record<Exclude<StoryShipId, "blocker">, Vec>>;
  readonly scenes: Readonly<Record<StorySceneId, StoryScene>>;
  readonly sector: SectorId;
} = {
  destinations: {
    miner: MINER,
    visitors: { x: (VISITOR_1.x + VISITOR_2.x) / 2, y: (VISITOR_1.y + VISITOR_2.y) / 2 },
  },
  hold: { miner: MINER, "visitor-1": VISITOR_1, "visitor-2": VISITOR_2 },
  scenes: {
    // The blocking pilot cuts across the miner's approach and the miner turns away.
    blocked: {
      duration: 8,
      line: "firstDeposit",
      paths: {
        blocker: [
          { at: 0, x: 300, y: -300 },
          { at: 3, x: -100, y: 60 },
          { at: 5, x: -350, y: 330 },
          { at: 8, x: -800, y: 700 },
        ],
        miner: [
          { at: 0, ...MINER },
          { at: 2.6, x: -110, y: 45 },
          { at: 3.4, x: -135, y: 75 },
          { at: 8, ...MINER },
        ],
      },
    },
    // The regulars meet below the hub, fly in together and dock; the blocking pilot flies off.
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
          { at: 0, ...MINER },
          { at: 3.5, x: 80, y: 130 },
          { at: 8.5, x: 30, y: 40 },
        ],
        "visitor-1": [
          { at: 0, ...VISITOR_1 },
          { at: 3.5, x: 130, y: 110 },
          { at: 8.5, x: 50, y: 20 },
        ],
        "visitor-2": [
          { at: 0, ...VISITOR_2 },
          { at: 3.5, x: 100, y: 130 },
          { at: 8.5, x: 10, y: 60 },
        ],
      },
    },
  },
  sector: 2,
};
