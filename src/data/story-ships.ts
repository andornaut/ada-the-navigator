import type { Vec } from "../model/types.ts";
import { SCREEN } from "./screen.ts";
import type { SectorId } from "./types.ts";

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
 * Art's craft for each story ship (art/cartwheel.md "Story craft"), drawn from the manifest's
 * `craft-{craft}-{k}` frames. The blocking pilot's design is not final, so its craft name is
 * the one place to swap it.
 */
export const STORY_SHIP_CRAFT: Readonly<Record<StoryShipId, string>> = {
  blocker: "blocker",
  miner: "miner",
  "visitor-1": "visitor1",
  "visitor-2": "visitor2",
};

/**
 * Art's mooring buoy (art/cartwheel.md "Mooring buoy") in frame px: the frame, its pivot on
 * the world plane, its display scale and the three arm tips with their outward screen
 * directions. The scene draws the manifest entry; these values place the moored craft.
 */
export const MOORING_BUOY = {
  displayScale: 0.4375,
  frame: { height: 80, width: 96 },
  moorings: {
    back: { outward: [0.534, -0.845], x: 61.019, y: 24.409 },
    left: { outward: [-1, 0], x: 10.033, y: 45 },
    right: { outward: [1, 0], x: 85.967, y: 45 },
  },
  pivot: { x: 0.5, y: 0.5625 },
} as const;

/**
 * Where story craft and buoys may stand while Ada is docked at the hub: the view's
 * half-extents in game area units, less a margin for the HUD and the touch controls and the
 * largest drawn half-size, the miner's 56 display px frame.
 */
export const STORY_VIEW = (() => {
  const margin = 40;
  const drawnHalf = 28;
  return {
    drawnHalf,
    halfHeight: SCREEN.height / 2 - margin - drawnHalf,
    halfWidth: SCREEN.width / 2 - margin - drawnHalf,
    margin,
  };
})();

/** A screen offset in display px as a world offset: (x, y) draws at (x - y, (x + y) / 2). */
function screenToWorld(x: number, y: number): Vec {
  return { x: y + x / 2, y: y - x / 2 };
}

/** The hub-relative world offset drawn at a fraction of the docked view's half-extents. */
function inView(across: number, down: number): Vec {
  return screenToWorld(across * STORY_VIEW.halfWidth, down * STORY_VIEW.halfHeight);
}

/** A craft moored `gap` display px beyond a buoy's arm tip, along the arm. */
function moored(buoy: Vec, tip: keyof typeof MOORING_BUOY.moorings, gap: number): Vec {
  const { displayScale, frame, moorings, pivot } = MOORING_BUOY;
  const arm = moorings[tip];
  const length = Math.hypot(arm.outward[0], arm.outward[1]);
  const at = screenToWorld(
    (arm.x - pivot.x * frame.width) * displayScale + (arm.outward[0] / length) * gap,
    (arm.y - pivot.y * frame.height) * displayScale + (arm.outward[1] / length) * gap,
  );
  return { x: buoy.x + at.x, y: buoy.y + at.y };
}

/** The miner's buoy on the view's left and the visitors' on its right, level with the hub. */
const BUOYS = { miner: inView(-0.85, 0), visitors: inView(0.95, -0.1) };
const MINER = moored(BUOYS.miner, "left", 22);
const VISITOR_1 = moored(BUOYS.visitors, "left", 14);
const VISITOR_2 = moored(BUOYS.visitors, "back", 14);

/**
 * The hub's live dock and its two free berths (art/cartwheel.md "Hub") as world offsets from
 * its pivot: frame px from the 240 px frame's pivot (0.5, 0.5625), at the 0.4375 display scale.
 */
const HUB_DOCKS = (() => {
  const at = (x: number, y: number) => screenToWorld((x - 120) * 0.4375, (y - 135) * 0.4375);
  return { left: at(21.374, 175.72), live: at(120, 216.317), right: at(218.626, 175.72) };
})();

/**
 * Cartwheel's story ships (gameplay/rules.md): the miner, two regular visitors and the
 * blocking pilot. Between scenes the miner and the visitors wait moored at two buoys inside
 * the docked view, facing the hub; each buoy is its group's story destination, outside the
 * hub's safe area and two safe areas from the other. Each scene moves its ships along scripted
 * paths, then its line plays. Ships that dock stay docked: the miner at the live dock, the
 * visitors at the free berths. Values are provisional tuning in world units and seconds.
 */
export const CARTWHEEL_STORY_SHIPS: {
  readonly buoys: Readonly<Record<"miner" | "visitors", Vec>>;
  readonly destinations: Readonly<Record<"miner" | "visitors", Vec>>;
  readonly hold: Readonly<Record<Exclude<StoryShipId, "blocker">, Vec>>;
  readonly scenes: Readonly<Record<StorySceneId, StoryScene>>;
  readonly sector: SectorId;
  /** The story destination the waiting ships hold beside, which stands for them on the Map. */
  readonly station: string;
} = {
  buoys: BUOYS,
  destinations: BUOYS,
  hold: { miner: MINER, "visitor-1": VISITOR_1, "visitor-2": VISITOR_2 },
  scenes: {
    // The blocking pilot cuts across the miner's approach and the miner turns away.
    blocked: {
      duration: 8,
      line: "firstDeposit",
      paths: {
        blocker: [
          { at: 0, x: -420, y: -60 },
          { at: 3, x: -80, y: 110 },
          { at: 5, x: -330, y: 380 },
          { at: 8, x: -800, y: 800 },
        ],
        miner: [
          { at: 0, ...MINER },
          { at: 2.6, x: -95, y: 95 },
          { at: 3.4, x: -125, y: 110 },
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
          { at: 8.5, ...HUB_DOCKS.live },
        ],
        "visitor-1": [
          { at: 0, ...VISITOR_1 },
          { at: 3.5, x: 70, y: 160 },
          { at: 8.5, ...HUB_DOCKS.left },
        ],
        "visitor-2": [
          { at: 0, ...VISITOR_2 },
          { at: 3.5, x: 120, y: 100 },
          { at: 8.5, ...HUB_DOCKS.right },
        ],
      },
    },
  },
  sector: 2,
  station: "hub",
};
