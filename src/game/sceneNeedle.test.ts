import { describe, expect, it } from "vitest";

import MANIFEST from "../../public/art/needle/manifest.json" with { type: "json" };
import { NEEDLE } from "../data/needle.ts";
import { createNeedleCourse, type NeedleCourse, needleDebris } from "../model/needle.ts";
import type { SpaceObject } from "../model/types.ts";
import { driftChipsFromBounds } from "./asteroidArt.ts";
import {
  createNeedleRenderer,
  type NeedleImage,
  type NeedleRenderFrame,
  needleStitches,
} from "./sceneNeedle.ts";

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
    courses: [course],
    debris: [],
    lit: () => 0,
    player: first,
    playerDepth: 2.002,
    reducedMotion: false,
    seed: 123,
    slow: false,
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
      expect([image.width, image.height, image.origin]).toEqual([49, 49, { x: 0.5, y: 0.5 }]);
      expect(
        image.texture.endsWith("back")
          ? image.depth < f.frame.playerDepth
          : image.depth > f.frame.playerDepth,
      ).toBe(true);
    }
    expect(f.styles[0]).toEqual([1, 0xcfc5bd, 0.38]);
    expect(f.lines.length).toBeGreaterThan(0);
  });

  it("fades the lit pair over opaque dark support using frozen flight time and retains lit gates at high speed", () => {
    const f = fixture();
    f.renderer.draw(f.frame);
    const lit = { ...f.frame, lit: () => 1 };
    f.renderer.draw(lit);
    f.renderer.draw({ ...lit, timeMs: 120 });
    const front = () =>
      f.images.findLast(
        (i) =>
          !i.destroyed && i.x === 360 && i.texture.includes("lit") && i.texture.endsWith("front"),
      )!;
    expect(front().alpha).toBeCloseTo(0.875);
    expect(
      f.images.find((i) => !i.destroyed && i.x === 360 && i.texture.includes("dark"))!.alpha,
    ).toBe(1);
    f.renderer.draw({ ...lit, timeMs: 120 });
    expect(front().alpha).toBeCloseTo(0.875);
    f.renderer.draw({ ...lit, slow: false, timeMs: 500 });
    expect(front().alpha).toBe(1);
  });

  it("shows the slow-enough glow without changing progress and cuts under reduced motion", () => {
    const f = fixture();
    f.renderer.draw(f.frame);
    f.renderer.draw({ ...f.frame, reducedMotion: true, slow: true, timeMs: 1 });
    expect(f.images.some((i) => !i.destroyed && i.texture.includes("lit") && i.alpha === 1)).toBe(
      true,
    );
    expect(f.frame.lit(f.course)).toBe(0);
    f.renderer.draw({ ...f.frame, reducedMotion: false, slow: true, timeMs: 2 });
    expect(
      f.images.filter((i) => !i.destroyed && i.texture.includes("lit")).every((i) => i.alpha === 1),
    ).toBe(true);
    f.renderer.draw({ ...f.frame, reducedMotion: true, slow: false, timeMs: 3 });
    expect(f.images.filter((i) => !i.destroyed).every((i) => i.texture.includes("dark"))).toBe(
      true,
    );
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
    // Plate frame zero: published [11.687,19.8,61.704,47.4], pivot .5, scale 35/80.
    const chips = driftChipsFromBounds(
      { behind: { x: -24, y: -12 }, id: object.id, seed: 123 },
      {
        bottom: 3.2375,
        left: -12.3869375,
        right: 9.4955,
        top: -8.8375,
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
  it("draws six logical pixels on and four off at the actual two channel edges", () => {
    const marks = needleStitches(identity, straight());
    expect(marks).toEqual(
      [-105, 105].flatMap((y) => [
        { from: { x: 0, y }, to: { x: 6, y } },
        { from: { x: 10, y }, to: { x: 16, y } },
        { from: { x: 20, y }, to: { x: 25, y } },
      ]),
    );
  });

  it("keeps dash phase across path vertices instead of restarting at every sample", () => {
    const marks = needleStitches(
      identity,
      straight([
        { x: 0, y: 0 },
        { x: 13, y: 0 },
        { x: 25, y: 0 },
      ]),
    );
    expect(marks.slice(0, 4)).toEqual([
      { from: { x: 0, y: -105 }, to: { x: 6, y: -105 } },
      { from: { x: 10, y: -105 }, to: { x: 13, y: -105 } },
      { from: { x: 13, y: -105 }, to: { x: 16, y: -105 } },
      { from: { x: 20, y: -105 }, to: { x: 25, y: -105 } },
    ]);
  });

  it("measures dashes after projection rather than changing their lengths with world angle", () => {
    const projected = { project: (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y / 2 }) };
    const marks = needleStitches(projected, straight());
    expect(marks[0]).toEqual({ from: { x: 0, y: -52.5 }, to: { x: 6, y: -52.5 } });
    expect(marks).toHaveLength(10);
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
        marks.every(({ from, to }) => Math.hypot(to.x - from.x, to.y - from.y) <= 6.000001),
      ).toBe(true);
      expect(course).toEqual(before);
    }
  });
});
