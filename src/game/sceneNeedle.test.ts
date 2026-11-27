import { describe, expect, it } from "vitest";

import MANIFEST from "../../public/art/needle/manifest.json" with { type: "json" };
import { driftChipsFromBounds } from "../art/asteroidArt.ts";
import { CONTENT } from "../data/content.ts";
import { NEEDLE } from "../data/needle.ts";
import { chapterRuntime } from "../model/chapters.ts";
import { GameModel } from "../model/game.ts";
import {
  activeNeedleCourses,
  createNeedleCourse,
  type NeedleCourse,
  needleDebris,
  setNeedleActivity,
} from "../model/needle.ts";
import type { SpaceObject } from "../model/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { COLOURS, UNLISTED_COLOURS } from "../ui/layout/colours.ts";
import {
  createNeedleRenderer,
  type NeedleImage,
  type NeedleRenderFrame,
  needleRenderFrame,
  needleStitches,
} from "./sceneNeedle.ts";

describe("production Needle frame", () => {
  const context = {
    activityLit: 4,
    playerDepth: 2.002,
    progress: { approach: "independent" as const, eyeLit: 2, practiceLit: 3 },
    reducedMotion: false,
    topSpeed: 100,
  };
  const flight = () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.unlocked.push(4);
    model.startGalaxy(4);
    return model.state.flight!;
  };

  it("follows the actual chapter mount and leaves other galaxies alone", () => {
    const f = flight();
    expect(needleRenderFrame(context, f) !== null).toBe(chapterRuntime(4) !== undefined);
    f.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: false };
    f.galaxy = 1;
    expect(needleRenderFrame(context, f)).toBeNull();
  });

  it("uses canonical active courses, progress, strict speed and paused flight time", () => {
    const f = flight();
    f.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: false };
    f.time = 1.25;
    f.velocity = { x: 49, y: 0 };
    let frame = needleRenderFrame(context, f)!;
    expect(frame.courses.map((course) => course.kind)).toEqual(["practice", "eye"]);
    expect(frame.courses.map(frame.lit)).toEqual([3, 2]);
    expect(frame.timeMs).toBe(1250);
    expect(frame.playerDepth).toBe(context.playerDepth);
    expect(frame.activeCourse).toBe("eye");
    expect(frame.readiness).toBe("green");
    f.velocity.x = 50;
    setNeedleActivity(f, true);
    frame = needleRenderFrame(context, f)!;
    expect(frame.readiness).toBe("yellow");
    expect(frame.courses.map((course) => course.kind)).toEqual(["practice", "eye", "activity"]);
    expect(frame.courses.map(frame.lit)).toEqual([3, 2, 4]);
    expect(frame.timeMs).toBe(1250);
    setNeedleActivity(f, false);
    expect(needleRenderFrame(context, f)!.courses).toHaveLength(2);
  });

  it("joins only live authored debris and retains descriptor identity while bodies drift", () => {
    const f = flight();
    f.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: false };
    const descriptor = needleDebris(activeNeedleCourses(f)[0]!, f.seed)[0]!;
    const object: SpaceObject = {
      hp: 1,
      id: descriptor.id,
      kind: "debris",
      radius: descriptor.radius,
      velocity: { ...descriptor.velocity },
      x: descriptor.x,
      y: descriptor.y,
    };
    f.objects = [object, { ...object, id: "ordinary-debris" }];
    const first = needleRenderFrame(context, f)!;
    expect(first.debris).toHaveLength(1);
    expect(first.debris[0]!.object).toBe(object);
    object.x += 5;
    const moved = needleRenderFrame(context, f)!;
    expect(moved.debris[0]!.object.x).toBe(descriptor.x + 5);
    expect(moved.debris[0]!.descriptor).toBe(first.debris[0]!.descriptor);
    expect(moved.debris[0]!.descriptor).toEqual(descriptor);
    f.objects = [];
    expect(needleRenderFrame(context, f)!.debris).toEqual([]);
    f.objects = [{ ...object, kind: "rock" }];
    expect(needleRenderFrame(context, f)!.debris).toEqual([]);
  });
});

const straight = (
  path = [
    { x: 0, y: 0 },
    { x: 25, y: 0 },
  ],
): NeedleCourse => ({
  gates: [],
  holodisk: { x: 0, y: 0 },
  kind: "practice",
  pack: { x: 0, y: 0 },
  path,
  width: 210,
});

class Image implements NeedleImage {
  alpha = 1;
  depth = 0;
  destroyed = false;
  height = 0;
  origin = { x: 0, y: 0 };
  texture = "";
  tint = 0xffffff;
  width = 0;
  x = 0;
  y = 0;
  destroy() {
    this.destroyed = true;
  }
  setAlpha(value: number) {
    this.alpha = value;
    return this;
  }
  setDepth(value: number) {
    this.depth = value;
    return this;
  }
  setDisplaySize(width: number, height: number) {
    this.width = width;
    this.height = height;
    return this;
  }
  setOrigin(x: number, y: number) {
    this.origin = { x, y };
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setTexture(texture: string) {
    this.texture = texture;
    return this;
  }
  setTint(tint: number) {
    this.tint = tint;
    return this;
  }
}

function fixture() {
  const course = createNeedleCourse({ anchor: { x: 0, y: 0 } }, "practice");
  const first = course.gates[0]!.point;
  const images: Image[] = [];
  const lines: number[][] = [];
  const fills: number[][] = [];
  const rectangles: number[][] = [];
  const styles: number[][] = [];
  const textures = new Set(MANIFEST.assets.map((a) => a.id));
  const context = {
    add: {
      image: () => {
        const image = new Image();
        images.push(image);
        return image;
      },
    },
    chipColor: 0x766f66,
    ink: {
      fillRect: (...values: number[]) => rectangles.push(values),
      fillStyle: (...values: number[]) => fills.push(values),
      lineBetween: (...values: number[]) => lines.push(values),
      lineStyle: (...values: number[]) => styles.push(values),
    },
    project: (p: { x: number; y: number }) => ({ x: p.x - first.x + 360, y: p.y - first.y + 180 }),
    textures: { exists: (key: string) => textures.has(key) },
    viewport: { height: 360, width: 720 },
  };
  const frame: NeedleRenderFrame = {
    activeCourse: "practice",
    courses: [course],
    debris: [],
    lit: () => 0,
    player: first,
    playerDepth: 2.002,
    readiness: "red",
    reducedMotion: false,
    seed: 123,
    timeMs: 0,
  };
  return {
    context,
    course,
    fills,
    frame,
    images,
    lines,
    rectangles,
    renderer: createNeedleRenderer(context),
    styles,
    textures,
  };
}

describe("Needle renderer lifecycle and published gate art", () => {
  it("draws only published gate frames at their authored size with back and front around the ship", () => {
    const f = fixture();
    f.renderer.draw(f.frame);
    const gate = f.images.filter((i) => !i.destroyed && i.x === 360 && i.y === 180);
    expect(gate).toHaveLength(2);
    for (const image of gate) {
      expect(f.textures.has(image.texture)).toBe(true);
      expect([image.width, image.height, image.origin]).toEqual([126, 126, { x: 0.5, y: 0.5 }]);
      expect(
        image.texture.endsWith("back")
          ? image.depth < f.frame.playerDepth
          : image.depth > f.frame.playerDepth,
      ).toBe(true);
    }
    expect(f.styles[0]).toEqual([2, 0xcfc5bd, 0.6]);
    expect(f.lines.length).toBeGreaterThan(0);
  });

  it("draws the first visible signal immediately and changes it without advancing flight time", () => {
    const f = fixture();
    for (const [readiness, colour] of [
      ["red", COLOURS.refusalRed],
      ["yellow", UNLISTED_COLOURS.mapWorkshop],
      ["green", COLOURS.momTab],
    ] as const) {
      f.renderer.draw({ ...f.frame, readiness });
      const gate = f.images.filter((i) => !i.destroyed && i.x === 360 && i.y === 180);
      expect(gate).toHaveLength(2);
      for (const layer of gate) {
        expect(layer.texture).toContain("lit");
        expect(layer.alpha).toBe(1);
        expect(layer.tint).toBe(Number.parseInt(colour.slice(1), 16));
      }
    }
  });

  it("keeps cleared and inactive gates distinct and untinted, including in reduced motion", () => {
    const f = fixture();
    f.renderer.draw({ ...f.frame, readiness: "green", reducedMotion: true });
    f.renderer.draw({ ...f.frame, lit: () => 1, reducedMotion: true });
    const atFirst = () => f.images.filter((i) => !i.destroyed && i.x === 360 && i.y === 180);
    expect(atFirst().map((i) => [i.texture.includes("lit"), i.tint, i.alpha])).toEqual([
      [true, 0xffffff, 1],
      [true, 0xffffff, 1],
    ]);
    f.renderer.draw({ ...f.frame, activeCourse: "eye", readiness: "green", reducedMotion: true });
    expect(atFirst().map((i) => [i.texture.includes("dark"), i.tint, i.alpha])).toEqual([
      [true, 0xffffff, 1],
      [true, 0xffffff, 1],
    ]);
  });

  it("reuses visible sprites and destroys stale ones on culling, hidden courses, clear and disposal", () => {
    const f = fixture();
    f.renderer.draw(f.frame);
    const count = f.images.length;
    for (let i = 0; i < 100; i++) {
      f.renderer.draw(f.frame);
    }
    expect(f.images).toHaveLength(count);
    f.renderer.draw({ ...f.frame, courses: [] });
    expect(f.images.every((i) => i.destroyed)).toBe(true);
    f.renderer.draw(f.frame);
    expect(f.images.some((i) => !i.destroyed)).toBe(true);
    f.renderer.clear();
    expect(f.images.every((i) => i.destroyed)).toBe(true);
    f.renderer.draw({ ...f.frame, lit: () => 1, timeMs: 0 });
    expect(f.images.some((i) => !i.destroyed && i.texture.includes("lit") && i.alpha === 1)).toBe(
      true,
    );
    f.renderer.dispose();
    const disposedCount = f.images.length;
    f.renderer.draw(f.frame);
    expect(f.images).toHaveLength(disposedCount);
    expect(f.images.every((i) => i.destroyed)).toBe(true);
  });
});

describe("Needle ordinary debris frames", () => {
  it("places four canonical chips using published visual bounds and the current palette", () => {
    const f = fixture();
    const descriptor = { ...needleDebris(f.course, 123)[0]!, piece: "needle-debris-plate" };
    const object: SpaceObject = {
      ...f.course.gates[0]!.point,
      hp: 1,
      id: "visual-bounds",
      kind: "debris",
      radius: 10,
      velocity: { x: 24, y: 0 },
    };
    const frame = { ...f.frame, debris: [{ descriptor, object }], reducedMotion: true };
    const original = structuredClone(object);
    f.renderer.draw(frame);
    // Plate frame zero's published bounds about its pivot, at display 35 over frame 80.
    const plate = NEEDLE.channels.debris.pieces.find(({ id }) => id === "needle-debris-plate")!;
    const [minX, minY, maxX, maxY] = plate.frames[0]!.bounds;
    expect(plate.frames[0]!.bounds).toEqual([7.12, 18.745, 61.487, 59.542]);
    const scale = plate.display / plate.frame;
    const pivot = { x: plate.pivot[0]! * plate.frame, y: plate.pivot[1]! * plate.frame };
    const chips = driftChipsFromBounds(
      { behind: { x: -24, y: -12 }, id: object.id, seed: 123 },
      {
        bottom: (maxY! - pivot.y) * scale,
        left: (minX! - pivot.x) * scale,
        right: (maxX! - pivot.x) * scale,
        top: (minY! - pivot.y) * scale,
      },
    );
    expect(f.fills).toEqual([
      [0x766f66, 0.9],
      [0x766f66, 0.7],
      [0x766f66, 0.5],
      [0x766f66, 0.35],
    ]);
    expect(f.rectangles).toHaveLength(4);
    f.rectangles.forEach((rect, index) => {
      const chip = chips[index]!;
      expect(rect[0]).toBeCloseTo(360 + chip.x - chip.size / 2, 9);
      expect(rect[1]).toBeCloseTo(180 + chip.y - chip.size / 2, 9);
      expect(rect.slice(2)).toEqual([chip.size, chip.size]);
    });
    f.renderer.draw({ ...frame, timeMs: 100000 });
    expect(f.rectangles.slice(4)).toEqual(f.rectangles.slice(0, 4));
    f.renderer.draw({
      ...frame,
      debris: [{ descriptor: { ...descriptor, tumblePhase: 135 }, object }],
      reducedMotion: false,
    });
    expect(f.rectangles.slice(-4)).not.toEqual(f.rectangles.slice(0, 4));
    expect(object).toEqual(original);
  });

  it("uses actual drift and emits no chips for still, culled or missing-art debris", () => {
    const f = fixture();
    const descriptor = needleDebris(f.course, 123)[0]!;
    const object: SpaceObject = {
      ...f.course.gates[0]!.point,
      hp: 1,
      id: descriptor.id,
      kind: "debris",
      radius: 10,
      velocity: { x: 0, y: 0 },
    };
    const frame = { ...f.frame, debris: [{ descriptor, object }], reducedMotion: true };
    f.renderer.draw(frame);
    expect(f.rectangles).toEqual([]);
    const moving = { ...object, velocity: { x: 24, y: 0 }, x: object.x + 5000 };
    f.renderer.draw({ ...frame, debris: [{ descriptor, object: moving }] });
    expect(f.rectangles).toEqual([]);
    f.textures.delete(`${descriptor.piece}-0`);
    f.renderer.draw({ ...frame, debris: [{ descriptor, object: { ...moving, x: object.x } }] });
    expect(f.rectangles).toEqual([]);
  });

  it("uses the actual moved object position, descriptor piece and tumble phase without integrating movement", () => {
    const f = fixture();
    const descriptor = {
      ...needleDebris(f.course, 123)[0]!,
      tumbleDegreesPerSecond: 90,
      tumblePhase: 45,
    };
    const object: SpaceObject = {
      ...f.course.gates[0]!.point,
      hp: 1,
      id: descriptor.id,
      kind: "debris",
      radius: 10,
    };
    const frame = { ...f.frame, debris: [{ descriptor, object }], timeMs: 1000 };
    const before = structuredClone(object);
    expect(f.renderer.draw(frame).has(object.id)).toBe(true);
    const image = f.images.find((i) => i.texture.startsWith(descriptor.piece))!;
    expect(image.texture).toBe(`${descriptor.piece}-3`);
    expect([image.width, image.height, image.x, image.y]).toEqual([35, 35, 360, 180]);
    expect(object).toEqual(before);
    f.renderer.draw({ ...frame, reducedMotion: true });
    expect(image.texture).toBe(`${descriptor.piece}-0`);
    expect(NEEDLE.channels.debris.pieces.some((p) => p.id === descriptor.piece)).toBe(true);
  });

  it("returns handled IDs for culled debris, but not missing art, and releases removed debris sprites", () => {
    const f = fixture();
    const descriptor = needleDebris(f.course, 123)[0]!;
    const object: SpaceObject = {
      ...f.course.gates[0]!.point,
      hp: 1,
      id: descriptor.id,
      kind: "debris",
      radius: 10,
    };
    const frame = { ...f.frame, debris: [{ descriptor, object }], reducedMotion: true };
    f.renderer.draw(frame);
    const sprite = f.images.find((i) => i.texture.startsWith(descriptor.piece))!;
    const outside = { ...object, x: object.x + 5000 };
    expect(
      f.renderer.draw({ ...frame, debris: [{ descriptor, object: outside }] }).has(object.id),
    ).toBe(true);
    expect(sprite.destroyed).toBe(true);
    f.textures.delete(`${descriptor.piece}-0`);
    expect(f.renderer.draw(frame).has(object.id)).toBe(false);
    expect(
      f.renderer
        .draw({ ...frame, debris: [{ descriptor: { ...descriptor, piece: "missing" }, object }] })
        .has(object.id),
    ).toBe(false);
  });
});
const identity = { project: (p: { x: number; y: number }) => p };

describe("Needle channel stitch", () => {
  it("draws ten logical pixels on and eight off at the actual two channel edges", () => {
    expect(NEEDLE.channels.stitch.dash).toEqual([10, 8]);
    const marks = needleStitches(
      identity,
      straight([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ]),
    );
    expect(marks).toEqual(
      [-105, 105].flatMap((y) => [
        { from: { x: 0, y }, to: { x: 10, y } },
        { from: { x: 18, y }, to: { x: 28, y } },
        { from: { x: 36, y }, to: { x: 40, y } },
      ]),
    );
  });

  it("keeps dash phase across path vertices instead of restarting at every sample", () => {
    const marks = needleStitches(
      identity,
      straight([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 25, y: 0 },
      ]),
    );
    expect(marks.slice(0, 3)).toEqual([
      { from: { x: 0, y: -105 }, to: { x: 5, y: -105 } },
      { from: { x: 5, y: -105 }, to: { x: 10, y: -105 } },
      { from: { x: 18, y: -105 }, to: { x: 25, y: -105 } },
    ]);
  });

  it("measures dashes after projection rather than changing their lengths with world angle", () => {
    const projected = { project: (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y / 2 }) };
    const marks = needleStitches(projected, straight());
    expect(marks[0]).toEqual({ from: { x: 0, y: -52.5 }, to: { x: 10, y: -52.5 } });
    expect(marks).toHaveLength(6);
  });

  it("does not emit non-finite segments for an empty or repeated path", () => {
    expect(needleStitches(identity, straight([]))).toEqual([]);
    expect(
      needleStitches(
        identity,
        straight([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ]),
      ),
    ).toEqual([]);
  });

  it("renders the actual authored Eye and practice without changing their model geometry", () => {
    for (const kind of ["eye", "practice"] as const) {
      const course = createNeedleCourse({ anchor: { x: 50, y: -20 } }, kind);
      const before = structuredClone(course);
      const marks = needleStitches(identity, course);
      expect(marks.length).toBeGreaterThan(100);
      expect(
        marks.every(({ from, to }) => Math.hypot(to.x - from.x, to.y - from.y) <= 10.000001),
      ).toBe(true);
      expect(course).toEqual(before);
    }
  });
});
