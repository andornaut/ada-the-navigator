import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { rockFrame } from "../model/asteroids.ts";
import { debrisPieceIndex } from "../model/debrisBody.ts";
import { carriesStardust } from "../model/drops.ts";
import { orePickupSize } from "../model/pickupBody.ts";
import type { SpaceObject } from "../model/types.ts";
import { footprintOutline, hexNumber, playDepth } from "./asteroidArt.ts";
import { debrisFrame, debrisMarks, debrisPiece, readDebrisArt } from "./debrisArt.ts";

// Execute the production render boundary without starting Phaser's DOM renderer.
const source = ts.createSourceFile(
  "sceneObjects.ts",
  readFileSync(new URL("./sceneObjects.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const names = ["drawObject", "drawTravelingDebris", "drawAsteroidSprite", "drawAsteroid"];
const renderCode = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ""))
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");

function fixture(galaxy = 1, ready = true, reducedMotion = false) {
  const ink = {
    fillEllipse: vi.fn(),
    fillPoints: vi.fn(),
    fillStyle: vi.fn(),
    lineBetween: vi.fn(),
    lineStyle: vi.fn(),
    strokeEllipse: vi.fn(),
    strokeRect: vi.fn(),
  };
  const sprite = {
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
  };
  const objectSprite = vi.fn<(scene: unknown, id: string, texture: string) => typeof sprite>(
    () => sprite,
  );
  const rockFrameTexture = vi.fn((_scene: unknown, art: AsteroidArt, frame: number) =>
    ready ? `${art.id}-${frame}` : undefined,
  );
  const art = new Map(
    ([2, 3] as const).map((id) => [
      id,
      readDebrisArt(
        JSON.parse(
          readFileSync(
            new URL(
              `../../public/art/${id === 2 ? "cartwheel" : "whirlpool"}/debris.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      )!,
    ]),
  );
  const scene = {
    asteroidArt: ASTEROID_ART,
    debrisArt: art,
    ink,
    model: { state: { flight: { galaxy, seed: 314, time: 12.5 } } },
    palette: { environment: 0x645c54 },
    project: () => ({ x: 120, y: 140 }),
    reducedMotion,
    textures: { exists: vi.fn(() => true) },
  };
  const drawStardust = vi.fn();
  const context = createContext({
    DEBRIS_STONES: ASTEROID_ART.asteroids.filter(({ size }) => size === "small"),
    PhaserMath: {
      Vector2: class {
        x: number;
        y: number;
        constructor(x: number, y: number) {
          this.x = x;
          this.y = y;
        }
      },
    },
    SCREEN: { height: 360, width: 720 },
    carriesStardust,
    debrisFrame,
    debrisMarks,
    debrisPiece,
    debrisPieceIndex,
    drawStardust,
    footprintOutline,
    hexNumber,
    keylineSprite: vi.fn(),
    objectSprite,
    orePickupSize,
    playDepth,
    rockArt: () => undefined,
    rockFrame,
    rockFrameTexture,
    scenerySilhouette: () => undefined,
    spaceObjectColor: () => 0xe4574e,
  });
  runInContext(
    ts.transpileModule(renderCode, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  );
  return { context, drawStardust, ink, objectSprite, rockFrameTexture, scene, sprite };
}

const debris = (id = "ballistic:0,0:1"): SpaceObject => ({
  hp: 3,
  id,
  kind: "debris",
  radius: 18,
  velocity: { x: 40, y: -12 },
  x: 40,
  y: 80,
});

describe("traveling debris rendering", () => {
  it("draws Sunflower ballistic debris with neutral stone at its existing footprint radius", () => {
    const f = fixture();
    const object = debris();
    const before = structuredClone(object);
    f.context.drawObject(f.scene, object);
    expect(f.objectSprite).toHaveBeenCalledOnce();
    const stone = f.rockFrameTexture.mock.calls[0]![1];
    expect(stone.size).toBe("small");
    expect(stone.id).toMatch(/^asteroid-s[1-4]$/u);
    const scale = object.radius / stone.footprintRadius;
    expect(f.sprite.setDisplaySize).toHaveBeenCalledWith(
      stone.display.width * scale,
      stone.display.height * scale,
    );
    expect(f.sprite.setOrigin).toHaveBeenCalledWith(stone.pivot.x, stone.pivot.y);
    expect(f.ink.fillEllipse).not.toHaveBeenCalled();
    expect(f.ink.strokeEllipse).not.toHaveBeenCalled();
    expect(object).toEqual(before);
  });

  it("keeps neutral stone variants and animation stable through reordering and holds reduced motion", () => {
    const f = fixture(1, true, true);
    const ids = Array.from({ length: 32 }, (_, index) => `ballistic:${index}`);
    const draw = (id: string) => {
      f.context.drawObject(f.scene, debris(id));
      expect(f.objectSprite).toHaveBeenCalled();
      return f.objectSprite.mock.calls.at(-1)![2];
    };
    const first = new Map(ids.map((id) => [id, draw(id)]));
    expect(new Set(first.values()).size).toBe(4);
    for (const id of [...ids].reverse()) {
      expect(draw(id)).toBe(first.get(id));
      expect(draw(id)).toMatch(/-0$/u);
    }
  });

  it("draws the same scaled stone footprint while its texture loads, without a red oval", () => {
    const f = fixture(1, false);
    const object = debris();
    f.context.drawObject(f.scene, object);
    expect(f.objectSprite).not.toHaveBeenCalled();
    expect(f.rockFrameTexture).toHaveBeenCalledOnce();
    const [, stone, frame] = f.rockFrameTexture.mock.calls[0]!;
    const scale = object.radius / stone.footprintRadius;
    const expected = footprintOutline(stone, frame).parts[0]!.map((at) => ({
      x: 120 + at.x * scale,
      y: 140 + at.y * scale,
    }));
    expect(f.ink.fillPoints.mock.calls[0]![0]).toEqual(expected);
    expect(f.ink.lineStyle).toHaveBeenLastCalledWith(1.5, hexNumber(ASTEROID_ART.stone[1]!));
    expect(f.ink.strokeEllipse).not.toHaveBeenCalled();
  });

  it.each([2, 3])(
    "preserves galaxy %s authored debris pieces and their trailing marks",
    (galaxy) => {
      const f = fixture(galaxy);
      const object = debris();
      f.context.drawObject(f.scene, object);
      const art = f.scene.debrisArt.get(galaxy as 2 | 3)!;
      const piece = debrisPiece(art, object.id);
      const frame = debrisFrame(art, piece, object.id, false, 12.5);
      expect(f.objectSprite).toHaveBeenCalledWith(f.scene, object.id, `${piece.id}-${frame}`);
      expect(f.sprite.setDisplaySize).toHaveBeenCalledWith(
        piece.display.width,
        piece.display.height,
      );
      expect(f.ink.lineBetween).toHaveBeenCalledTimes(art.marks.dashes.length);
      expect(f.rockFrameTexture).not.toHaveBeenCalled();
      expect(f.ink.strokeEllipse).not.toHaveBeenCalled();
    },
  );

  it("leaves orbiting, stationary and other unassigned galaxies on their existing rendering paths", () => {
    const f = fixture();
    const orbiting = { ...debris(), orbit: { phase: 0, radius: 20, speed: 1, x: 0, y: 0 } };
    const still = debris();
    delete still.velocity;
    for (const object of [orbiting, still]) {
      expect(f.context.drawTravelingDebris(f.scene, object, { x: 120, y: 140 })).toBe(false);
    }
    f.scene.model.state.flight.galaxy = 4;
    expect(f.context.drawTravelingDebris(f.scene, debris(), { x: 120, y: 140 })).toBe(false);
    expect(f.objectSprite).not.toHaveBeenCalled();
  });
});

describe("ore quantity rendering", () => {
  it.each([
    [undefined, 11],
    [1, 11],
    [5, 18],
  ] as const)("draws cargo amount %s at %s using the same centered rest frame", (amount, size) => {
    const f = fixture();
    const object: SpaceObject = {
      ...(amount === undefined ? {} : { amount }),
      hp: 1,
      id: "ore",
      kind: "pickup",
      radius: 6,
      role: "cargo",
      x: 40,
      y: 80,
    };
    const before = structuredClone(object);
    f.context.drawObject(f.scene, object);
    expect(f.objectSprite).toHaveBeenCalledExactlyOnceWith(f.scene, object.id, "ore-nugget", 0);
    expect(f.sprite.setDisplaySize).toHaveBeenCalledExactlyOnceWith(size, size);
    expect(f.sprite.setOrigin).toHaveBeenCalledWith(0.5);
    expect(f.sprite.setPosition).toHaveBeenCalledWith(120, 140);
    expect(f.sprite.setDepth).toHaveBeenCalledWith(playDepth(140));
    expect(f.drawStardust).not.toHaveBeenCalled();
    expect(f.ink.strokeRect).not.toHaveBeenCalled();
    expect(object).toEqual(before);
  });

  it("keeps amount-5 Stardust on its own renderer instead of the ore texture", () => {
    const f = fixture();
    const object: SpaceObject = {
      amount: 5,
      hp: 1,
      id: "dust",
      kind: "pickup",
      radius: 6,
      x: 40,
      y: 80,
    };
    f.context.drawObject(f.scene, object);
    expect(f.drawStardust).toHaveBeenCalledExactlyOnceWith(
      f.scene,
      object,
      { x: 120, y: 140 },
      object.radius,
    );
    expect(f.objectSprite).not.toHaveBeenCalled();
  });

  it("keeps the large ore rest frame under reduced motion", () => {
    const f = fixture(1, true, true);
    const object: SpaceObject = {
      amount: 5,
      hp: 1,
      id: "ore-five",
      kind: "pickup",
      radius: 6,
      role: "cargo",
      x: 40,
      y: 80,
    };
    f.context.drawObject(f.scene, object);
    expect(f.objectSprite).toHaveBeenCalledExactlyOnceWith(f.scene, object.id, "ore-nugget", 0);
    expect(f.sprite.setDisplaySize).toHaveBeenCalledExactlyOnceWith(18, 18);
  });
});
