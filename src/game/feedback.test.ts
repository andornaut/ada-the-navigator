import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Point } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import {
  type CameraShake,
  HIT_FLASH_FILL,
  HIT_SHAKE_SHARE,
  hitFlashAlpha,
  hitFlashBands,
  ModelFeedback,
  readSpacePalette,
  shakeCounter,
} from "../art/index.ts";
import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { HIT_FLASH, HIT_SHAKE } from "../data/layout.ts";
import { createEnemy } from "../model/ai/index.ts";
import { wreckId } from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { syncFlightRegion } from "../model/geography.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { publicJson } from "../testing/publicArt.ts";
import { shakeIntensity } from "./playCamera.ts";

function launched() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  const feedback = new ModelFeedback();
  feedback.observe(100, model.state);
  return { feedback, flight: model.state.flight!, state: model.state };
}

describe("model feedback", () => {
  it("tracks independent hardpoint damage even when hull HP does not change", () => {
    const { feedback, flight, state } = launched();
    const enemy = createEnemy(
      enemyCatalog.frigate,
      { archetype: "frigate", id: "frigate", packId: null, phase: 0 },
      { x: 20, y: 30 },
    );
    flight.objects = [
      { enemy, hp: enemy.hp, id: enemy.id, kind: "enemy", radius: 30, x: 20, y: 30 },
    ];
    feedback.observe(100, state);
    enemy.hardpoints[0]!.hp--;
    expect(feedback.observe(100, state)).toEqual(["hit"]);
    enemy.hardpoints[0]!.hp = 0;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(flight.objects[0]!.hp).toBe(enemyCatalog.frigate.hp);
  });

  it("copies mutable shield and cargo values rather than retaining the flight reference", () => {
    const { feedback, flight, state } = launched();
    flight.shield -= 10;
    flight.cargo++;
    expect(feedback.observe(100, state)).toEqual(["damage", "pickup"]);
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("draws no pulse around Ada while the shield recharges", () => {
    const { feedback, flight, state } = launched();
    flight.shield -= 10;
    feedback.observe(100, state);
    feedback.advance(1);
    flight.shield += 1;
    expect(feedback.observe(100, state)).toEqual([]);
    expect(feedback.pulses).toEqual([]);
  });

  it("does not report switching back to laser fire as a pickup", () => {
    const { feedback, flight, state } = launched();
    flight.weapon = "rapidMissile";
    feedback.observe(100, state);
    flight.weapon = "laser";
    expect(feedback.observe(100, state)).not.toContain("pickup");
  });

  it("reports collected Stardust as a pickup", () => {
    const { feedback, state } = launched();
    feedback.observe(100, state);
    state.economy.stardust += 5;
    expect(feedback.observe(100, state)).toEqual(["pickup"]);
  });

  it("ignores object streaming removals without recorded combat evidence", () => {
    const { feedback, flight, state } = launched();
    flight.objects.push({ hp: 4, id: "departing", kind: "enemy", radius: 10, x: 400, y: 400 });
    feedback.observe(100, state);
    flight.objects = [];
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("shows disabled feedback for removed enemies only after the progress counter increases", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "target", kind: "enemy", radius: 10, x: 20, y: 30 }];
    feedback.observe(100, state);
    flight.objects = [];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses.at(-1)).toMatchObject({ kind: "disabled", x: 20, y: 30 });
  });

  it("sounds a kill but draws no marker once the enemy's destruction starts", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "target", kind: "enemy", radius: 10, x: 20, y: 30 }];
    feedback.observe(100, state);
    flight.objects = [
      {
        hp: 1,
        id: wreckId("target"),
        kind: "wreck",
        radius: 10,
        wreck: { age: 0, archetype: "fighter", facing: { x: 0, y: -1 } },
        x: 20,
        y: 30,
      },
    ];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses).toEqual([]);
  });

  it("attributes a same-step kill only to the defeated enemy when an earlier enemy is archived", () => {
    const { feedback, flight, state } = launched();
    const archived = {
      hp: 4,
      id: "archived-first",
      kind: "enemy" as const,
      radius: 10,
      x: 9000,
      y: 9000,
    };
    const defeated = {
      hp: 4,
      id: "defeated-second",
      kind: "enemy" as const,
      radius: 10,
      x: 20,
      y: 30,
    };
    flight.objects = [archived, defeated];
    feedback.observe(100, state);
    syncFlightRegion(CONTENT, flight);
    flight.objects = [];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses).toEqual([{ age: 0, kind: "disabled", x: 20, y: 30 }]);
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("does not emit hit feedback when an archived target appears in a projectile's hit history", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "archived-hit", kind: "enemy", radius: 10, x: 9000, y: 9000 }];
    feedback.observe(100, state);
    syncFlightRegion(CONTENT, flight);
    flight.shots = [
      {
        damage: CONTENT.tuning.flight.playerShotDamage,
        enemy: false,
        hitIds: ["archived-hit"],
        id: "surviving-projectile",
        life: 1,
        piercing: true,
        velocity: { x: 1, y: 0 },
        x: 20,
        y: 30,
      },
    ];
    expect(feedback.observe(100, state)).toEqual([]);
    expect(feedback.pulses).toEqual([]);
    expect(state.progress[1].destroyedEnemies).toBe(0);
  });

  it("distinguishes deposits and discontinuous travel from ordinary motion", () => {
    const { feedback, flight, state } = launched();
    flight.player.x += 1;
    expect(feedback.observe(100, state)).toEqual([]);
    state.progress[1].deposited++;
    flight.player.x += 200;
    expect(feedback.observe(100, state)).toEqual(["deposit", "teleport"]);
    feedback.advance(0.7);
    expect(feedback.pulses).toEqual([]);
  });
});

describe("hit feedback", () => {
  it("flashes the threat red at full opacity on a hit and follows the approved 120 ms fade", () => {
    const palette = readSpacePalette(publicJson("/art/space-palette.json"))!;
    expect(HIT_FLASH).toEqual({ colour: "#FF6B6B", duration: 120, width: 2 });
    expect(HIT_FLASH_FILL).toBe(palette.threat);
    expect(hitFlashAlpha(false, 0)).toBe(1);
    for (const [since, opacity] of [
      [20, 0.82],
      [40, 0.58],
      [60, 0.37],
      [80, 0.2],
      [100, 0.08],
    ] as const) {
      expect(Math.abs(hitFlashAlpha(false, since) - opacity)).toBeLessThan(0.01);
    }
    let previous = 1;
    for (let since = 1; since < HIT_FLASH.duration; since++) {
      const alpha = hitFlashAlpha(false, since);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(previous);
      previous = alpha;
    }
    expect(hitFlashAlpha(false, 120)).toBe(0);
    expect(hitFlashAlpha(false, 260)).toBe(0);
    // Before any hit the latest hit time is -Infinity, so the time since it is Infinity.
    expect(hitFlashAlpha(false, Infinity)).toBe(0);
    expect(hitFlashAlpha(false, -1)).toBe(0);
  });

  it("draws no flash under reduced motion", () => {
    for (const since of [0, 60, 119]) {
      expect(hitFlashAlpha(true, since)).toBe(0);
    }
  });

  it("bands the exact device viewport two pixels inside with square corners and no overlap", () => {
    const expected = [
      { height: 2, width: 1280, x: 0, y: 0 },
      { height: 2, width: 1280, x: 0, y: 637 },
      { height: 635, width: 2, x: 0, y: 2 },
      { height: 635, width: 2, x: 1278, y: 2 },
    ];
    for (const zoom of [0.8, 1, 1280 / 720, 2.1667]) {
      const bands = hitFlashBands(zoom, { height: 639 / zoom, width: 1280 / zoom, x: 0, y: 0 });
      expect(
        bands.map(({ height, width, x, y }) => ({
          height: Math.round(height * zoom),
          width: Math.round(width * zoom),
          x: Math.round(x * zoom),
          y: Math.round(y * zoom),
        })),
      ).toEqual(expected);
    }
  });

  it("holds the band fixed on the play view's edge through installed Phaser's shake", () => {
    // Phaser's own Shake and TransformMatrix, as Camera.preRender applies them: the zoomed view
    // matrix, then the shake's translate inside it.
    const phaser = dirname(createRequire(import.meta.url).resolve("phaser/package.json"));
    const load = createRequire(import.meta.url);
    const Shake = load(join(phaser, "src/cameras/2d/effects/Shake.js")) as new (
      camera: object,
    ) => CameraShake & {
      preRender(): void;
      start(duration: number, intensity: number): void;
      update(time: number, delta: number): void;
    };
    const TransformMatrix = load(
      join(phaser, "src/gameobjects/components/TransformMatrix.js"),
    ) as new () => {
      applyITRS(x: number, y: number, rotation: number, sx: number, sy: number): void;
      transformPoint(x: number, y: number, point: { x: number; y: number }): Point;
      translate(x: number, y: number): void;
    };
    for (const zoom of [1, 2.1667]) {
      const matrix = new TransformMatrix();
      const camera = {
        emit: () => undefined,
        height: 360 * zoom,
        matrix,
        roundPixels: false,
        scene: {},
        width: 720 * zoom,
        zoom,
      };
      const shake = new Shake(camera);
      const corners = hitFlashBands(zoom, { height: 360, width: 720, x: 0, y: 0 }).flatMap(
        (band) => [
          { x: band.x, y: band.y },
          { x: band.x + band.width, y: band.y + band.height },
        ],
      );
      const screen = (point: Point, counter: Point) => {
        matrix.applyITRS(0, 0, 0, zoom, zoom);
        matrix.translate(0, 0);
        shake.preRender();
        return matrix.transformPoint(point.x + counter.x, point.y + counter.y, { x: 0, y: 0 });
      };
      const rest = corners.map((corner) => screen(corner, shakeCounter(shake)));
      shake.start(HIT_SHAKE.duration, shakeIntensity(zoom, HIT_SHAKE_SHARE));
      let moved = 0;
      for (let time = 16; shake.isRunning; time += 16) {
        shake.update(time, 16);
        corners.forEach((corner, index) => {
          const held = screen(corner, shakeCounter(shake));
          // Phaser's matrix is single precision: within a hundredth of a device pixel.
          expect(held.x).toBeCloseTo(rest[index]!.x, 2);
          expect(held.y).toBeCloseTo(rest[index]!.y, 2);
          const shaken = screen(corner, { x: 0, y: 0 });
          moved = Math.max(moved, Math.abs(shaken.x - rest[index]!.x) / zoom);
        });
      }
      // The view itself did shake, by up to about 2 logical px.
      expect(moved).toBeGreaterThan(0);
      expect(moved).toBeLessThanOrEqual(2 + 1e-9);
      expect(shakeCounter(shake)).toEqual({ x: 0, y: 0 });
    }
  });

  it("shakes the view 2 logical px of the 720 base width for 100 ms", () => {
    expect(HIT_SHAKE).toEqual({ duration: 100, offset: 2 });
    expect(HIT_SHAKE_SHARE * 720).toBeCloseTo(2, 9);
  });
});
