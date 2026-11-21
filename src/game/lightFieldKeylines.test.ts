import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { KEYLINE_ALPHA, keylineOffsets, LIGHT_FIELD } from "./lightField.ts";
import { drawCraftJets, drawKeylines, keylineSprite } from "./sceneHud.ts";
import type { JetTriangle } from "./shipJets.ts";

vi.mock("phaser", () => ({
  GameObjects: { Image: class {} },
  Math: {},
  ScaleModes: { LINEAR: 1, NEAREST: 0 },
  Textures: {},
}));
vi.mock("./sceneAssets.ts", () => ({ filterTexture: vi.fn() }));
vi.mock("./touchChrome.ts", () => ({ createUseCallout: vi.fn() }));

/** A Graphics stand-in that records its depth and every fill. */
class Graphics {
  depth = 0;
  destroyed = false;
  fills: { color: number; alpha: number; points: number[] }[] = [];
  style = { alpha: 1, color: 0 };
  clear() {
    this.fills = [];
    return this;
  }
  destroy() {
    this.destroyed = true;
  }
  fillStyle(color: number, alpha = 1) {
    this.style = { alpha, color };
    return this;
  }
  fillTriangle(...points: number[]) {
    this.fills.push({ ...this.style, points });
    return this;
  }
  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setVisible() {
    return this;
  }
}

function jetsScene(light: boolean) {
  const made: Graphics[] = [];
  return {
    add: {
      graphics: () => {
        const graphics = new Graphics();
        made.push(graphics);
        return graphics;
      },
    },
    craftJets: new Map<string, Graphics>(),
    craftJetsDrawn: new Set<string>(),
    edgeInk: LIGHT_FIELD.ink,
    enemyJets: new Graphics(),
    light,
    made,
  };
}
const triangles: JetTriangle[] = [
  {
    alpha: 1,
    color: 0x7f4b3d,
    points: [
      { x: -10, y: 0 },
      { x: -20, y: -2 },
      { x: -20, y: 2 },
    ],
  },
  {
    alpha: 0.3,
    color: 0xa8654f,
    points: [
      { x: -10, y: 4 },
      { x: -24, y: 3 },
      { x: -24, y: 5 },
    ],
  },
];
const DEPTH = 2.5;
const POINT = { x: 100, y: 50 };

describe("light-field craft jets", () => {
  it("draws a keylined craft's jets in its own slot over the ink grown round them", () => {
    const scene = jetsScene(true);
    drawCraftJets(scene as never, "frigate", "enemy:1", POINT, DEPTH, triangles);
    expect(scene.enemyJets.fills).toEqual([]);
    const graphics = scene.craftJets.get("enemy:1")!;
    // Above the craft's keyline slot (DEPTH - 2e-6) and below its hull (DEPTH).
    expect(graphics.depth).toBeGreaterThan(DEPTH - 2e-6);
    expect(graphics.depth).toBeLessThan(DEPTH);
    const offsets = keylineOffsets(LIGHT_FIELD.keyline);
    const ink = graphics.fills.filter(({ color }) => color === LIGHT_FIELD.ink);
    // Only the triangle at alpha 0.5 or more joins the keyline, once per offset.
    expect(triangles.filter(({ alpha }) => alpha >= KEYLINE_ALPHA)).toHaveLength(1);
    expect(ink).toHaveLength(offsets.length);
    expect(ink.every(({ alpha }) => alpha === 1)).toBe(true);
    expect(ink.map(({ points }) => [points[0]! - 90, points[1]! - 50])).toEqual(
      offsets.map(({ x, y }) => [x, y]),
    );
    // The jets themselves draw last, over the ink, at their own colours and alphas.
    expect(graphics.fills.slice(-2)).toEqual([
      { alpha: 1, color: 0x7f4b3d, points: [90, 50, 80, 48, 80, 52] },
      { alpha: 0.3, color: 0xa8654f, points: [90, 54, 76, 53, 76, 55] },
    ]);
  });

  it("keeps Ada's jets and every dark field's jets on the shared jets layer", () => {
    for (const [light, kind] of [
      [true, "ship"],
      [false, "frigate"],
    ] as const) {
      const scene = jetsScene(light);
      drawCraftJets(scene as never, kind, "craft", POINT, DEPTH, triangles);
      expect(scene.craftJets.size, kind).toBe(0);
      expect(
        scene.enemyJets.fills.map(({ color }) => color),
        kind,
      ).toEqual([0x7f4b3d, 0xa8654f]);
    }
  });

  it("releases a craft's jets layer once it no longer draws", () => {
    const scene = {
      ...jetsScene(true),
      children: { list: [] },
      keyed: [],
      keylines: new Map(),
      silhouettes: { sweep: vi.fn() },
      textures: { remove: vi.fn() },
    };
    drawCraftJets(scene as never, "fighter", "enemy:2", POINT, DEPTH, triangles);
    drawKeylines(scene as never);
    expect(scene.craftJets.has("enemy:2")).toBe(true);
    drawKeylines(scene as never);
    expect(scene.craftJets.has("enemy:2")).toBe(false);
    expect(scene.made[0]!.destroyed).toBe(true);
  });
});

describe("light-field keyline kinds", () => {
  const record = (kind: string, light = true) => {
    const scene = { keyed: [] as unknown[], light };
    keylineSprite(scene as never, kind, "key", {} as never);
    return scene.keyed;
  };

  it("keylines every listed kind at 1 px, destinations at 2 px and nothing on a dark field", () => {
    const added = [
      "debris",
      "nurseryBeacon",
      "currentBuoy",
      "gadget",
      "hostileStation",
      "platform",
      "storyCraft",
      "guideBeacon",
      "mooringBuoy",
      "orePickup",
      "needleGate",
      "needleLamp",
      "whale",
    ];
    expect(LIGHT_FIELD.keylined).toEqual(expect.arrayContaining(added));
    for (const kind of added) {
      expect(record(kind), kind).toEqual([expect.objectContaining({ width: LIGHT_FIELD.keyline })]);
      expect(record(kind, false), kind).toEqual([]);
    }
    for (const kind of LIGHT_FIELD.destinationKeyline.kinds) {
      expect(record(kind), kind).toEqual([expect.objectContaining({ width: 2 })]);
    }
    // The holodisk's waypoint beacon keeps its own rule: no keyline.
    expect(record("holodiskBeacon")).toEqual([]);
  });

  it("draws each keylined kind's sprites over a keyline in its own draw path", () => {
    const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
    const paths: readonly [string, string, RegExp][] = [
      ["debris", "./sceneObjects.ts", /keylineSprite\(scene, "debris"/u],
      ["debris", "./sceneNeedle.ts", /keyline\?\.\("debris"/u],
      ["nurseryBeacon", "./sceneWorld.ts", /keylineSprite\(scene, "nurseryBeacon"/u],
      ["currentBuoy", "./sceneWorld.ts", /keylineSprite\(scene, "currentBuoy"/u],
      ["mooringBuoy", "./sceneWorld.ts", /keylineSprite\(scene, "mooringBuoy"/u],
      ["storyCraft", "./sceneWorld.ts", /keylineSprite\(scene, "storyCraft"/u],
      ["storyCraft", "./sceneAndromeda.ts", /keylineSprite\(scene, "storyCraft"/u],
      [
        "whale and storyCraft",
        "./scenePhantom.ts",
        new RegExp(
          String.raw`keylineSprite\(\s*scene,\s*ally\.behavior === "whale" \? "whale" : "storyCraft",` +
            String.raw`\s*key,\s*sprite,\s*depth - 2e-6,\s*\)`,
          "u",
        ),
      ],
      ["guideBeacon", "./sceneObjects.ts", /keylineSprite\(scene, "guideBeacon"/u],
      ["orePickup", "./sceneObjects.ts", /"orePickup",/u],
      ["whale", "./sceneObjects.ts", /keylineSprite\(scene, "whale"/u],
      ["needleGate", "./sceneNeedle.ts", /keyline\?\.\("needleGate"/u],
      // Enemy archetypes (gadget, hostileStation, platform) keyline by their archetype.
      ["enemy", "./sceneEnemies.ts", /keylineSprite\(scene, enemy\.archetype, key, sprite, depth/u],
    ];
    for (const [kind, file, pattern] of paths) {
      expect(source(file), `${kind} in ${file}`).toMatch(pattern);
    }
    // Craft that draw jets join them to their keyline.
    for (const file of ["./sceneEnemies.ts", "./sceneWorld.ts", "./scenePhantom.ts"]) {
      expect(source(file), file).toMatch(/drawCraftJets\(/u);
      expect(source(file), file).not.toMatch(/enemyJets\.fillTriangle/u);
    }
  });
});
