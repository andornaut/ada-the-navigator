import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { playDepth } from "./asteroid-art.ts";
import {
  ADA_LAYERS,
  adaDepth,
  boxWith,
  drawnBox,
  EDGE_MARKER_DEPTH,
  overlaps,
  type Placed,
} from "./draw-order.ts";

interface Frame {
  readonly displayHeight: number;
  readonly displayWidth: number;
  readonly id: string;
  readonly pivot: { readonly x: number; readonly y: number };
}

// Art's frames by id, wherever a manifest nests them.
function frameIn(manifest: string, id: string): Frame {
  const found: Frame[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      const record = value as Partial<Frame>;
      if (record.id === id && record.displayWidth && record.displayHeight && record.pivot) {
        found.push(record as Frame);
      }
      Object.values(value).forEach(walk);
    }
  };
  // The galaxy's manifest first, then core, where art several galaxies draw is listed.
  for (const file of [manifest, "manifest.json"]) {
    walk(JSON.parse(readFileSync(new URL(`../../public/art/${file}`, import.meta.url), "utf8")));
  }
  expect(found.length, `${manifest}: ${id}`).toBeGreaterThan(0);
  return found[0]!;
}

// One frame of each kind Ada flies through, as drawn. A wreck without its art draws at the
// enemy frame's 42 px fallback.
const FLY_THROUGH: readonly [string, Frame][] = [
  ["station dock", frameIn("manifest.json", "station-a")],
  ["Cartwheel hub", frameIn("cartwheel/manifest.json", "outpost-hub-a")],
  ["outpost", frameIn("sunflower/manifest.json", "outpost-growers-a")],
  ["story ship", frameIn("cartwheel/manifest.json", "craft-miner-0")],
  ["mooring buoy", frameIn("cartwheel/manifest.json", "mooring-buoy-a")],
  ["tow craft", frameIn("cartwheel/manifest.json", "craft-stranded-hauler-0")],
  ["whale", frameIn("whirlpool/manifest.json", "whale-whale-13-0")],
  ["calf", frameIn("whirlpool/manifest.json", "whale-calf-0-0")],
  ["holodisk", frameIn("manifest.json", "holodisk")],
  ["wreck", { displayHeight: 42, displayWidth: 42, id: "wreck", pivot: { x: 0.5, y: 0.5 } }],
];

const shipFrame = frameIn("manifest.json", "ship-0");
// Ada sits at the play view's centre.
const ada: Placed = {
  displayHeight: shipFrame.displayHeight,
  displayWidth: shipFrame.displayWidth,
  originX: shipFrame.pivot.x,
  originY: shipFrame.pivot.y,
  x: 360,
  y: 180,
};
const adaBox = drawnBox(ada);
const pivot = playDepth(ada.y);

function placed(frame: Frame, x: number, y: number): Placed {
  return {
    displayHeight: frame.displayHeight,
    displayWidth: frame.displayWidth,
    originX: frame.pivot.x,
    originY: frame.pivot.y,
    x,
    y,
  };
}

// The passable draw of a frame with its pivot at x, y, sorted by its pivot as the scene sorts it.
function drawn(frame: Frame, x: number, y: number) {
  return { box: drawnBox(placed(frame, x, y)), depth: playDepth(y) };
}

describe("Ada's draw order among the objects she flies through", () => {
  // Pivot offsets from Ada's: ahead and behind, left and right, near and far within reach.
  const offsets = (frame: Frame) => {
    const reachX = (frame.displayWidth + ada.displayWidth) / 2 - 2;
    const reachY = (frame.displayHeight + ada.displayHeight) / 2 - 2;
    return [
      [0, 1],
      [0, reachY * 0.5],
      [reachX * 0.6, reachY * 0.3],
      [-reachX * 0.6, reachY * 0.7],
      [reachX * 0.2, -reachY * 0.5],
    ].map(([dx, dy]) => ({ x: ada.x + dx!, y: ada.y + dy! }));
  };

  it.each(FLY_THROUGH)("draws Ada above a %s she overlaps", (_name, frame) => {
    for (const at of offsets(frame)) {
      const object = drawn(frame, at.x, at.y);
      const box = drawnBox(placed(frame, at.x, at.y));
      // Placed as the frame's pivot puts it, so the overlap is real, not assumed.
      if (!overlaps(adaBox, box)) {
        continue;
      }
      const depth = adaDepth([object], adaBox, pivot);
      expect(depth, `${frame.id} at ${at.x}, ${at.y}`).toBeGreaterThan(object.depth);
      // Her lowest layer, the tow line, clears it too.
      expect(depth + ADA_LAYERS.towLine).toBeGreaterThan(object.depth + 1e-6);
    }
  });

  it.each(FLY_THROUGH)("checks Ada overlapping a %s ahead of her", (_name, frame) => {
    // At least one placement per kind is ahead of Ada and overlapping, where plain sorting by
    // pivot would draw the object over her.
    const ahead = offsets(frame).filter(
      (at) => at.y > ada.y && overlaps(adaBox, drawnBox(placed(frame, at.x, at.y))),
    );
    expect(ahead.length).toBeGreaterThan(0);
    for (const at of ahead) {
      expect(playDepth(at.y)).toBeGreaterThan(pivot);
    }
  });

  it.each(FLY_THROUGH)(
    "keeps a %s she does not overlap in front of her when it is further forward",
    (_name, frame) => {
      const below = ada.y + ada.displayHeight + frame.displayHeight + 40;
      const apart = drawn(frame, ada.x, below);
      expect(overlaps(adaBox, apart.box)).toBe(false);
      expect(adaDepth([apart], adaBox, pivot)).toBe(pivot);
      expect(apart.depth).toBeGreaterThan(pivot);
      // Lifted above an overlapped station, Ada still draws behind it.
      const station = FLY_THROUGH[0]![1];
      const lifted = adaDepth([drawn(station, ada.x, ada.y + 10), apart], adaBox, pivot);
      expect(lifted).toBeGreaterThan(playDepth(ada.y + 10));
      expect(apart.depth).toBeGreaterThan(lifted);
    },
  );

  it("counts Ada's jet flames as part of her drawn bounds", () => {
    const whale = FLY_THROUGH.find(([name]) => name === "whale")![1];
    // A whale clear of the hull but under a flame trailing below it.
    const y = adaBox.bottom + whale.displayHeight * whale.pivot.y + 4;
    const object = drawn(whale, ada.x, y);
    expect(overlaps(adaBox, object.box)).toBe(false);
    expect(adaDepth([object], adaBox, pivot)).toBe(pivot);
    const flames = boxWith(adaBox, [{ x: ada.x, y: adaBox.bottom + 12 }]);
    expect(adaDepth([object], flames, pivot)).toBeGreaterThan(object.depth);
  });

  it("raises Ada above the frontmost of several objects she overlaps", () => {
    const [, station] = FLY_THROUGH[0]!;
    const [, buoy] = FLY_THROUGH[4]!;
    const near = drawn(station, ada.x, ada.y + 4);
    const front = drawn(buoy, ada.x + 8, ada.y + 18);
    expect(adaDepth([near, front], adaBox, pivot)).toBeGreaterThan(front.depth);
  });

  it("leaves Ada at her pivot's depth with nothing overlapping", () => {
    expect(adaDepth([], adaBox, pivot)).toBe(pivot);
  });

  it("keeps the edge markers above Ada at her highest lift and the destruction flash", () => {
    // The frontmost play depth with a heavy's parts stacked on it, all overlapping Ada.
    const front = 1e4;
    const parts = Array.from({ length: 20 }, (_, index) => ({
      box: adaBox,
      depth: playDepth(front) + index * 1e-7,
    }));
    expect(adaDepth(parts, adaBox, playDepth(front))).toBeLessThan(EDGE_MARKER_DEPTH);
    // Shots and indicators draw at 3, the destruction flash at 4.
    expect(EDGE_MARKER_DEPTH).toBeGreaterThan(4);
  });
});
