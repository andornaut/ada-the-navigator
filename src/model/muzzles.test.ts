import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import capitalFile from "../../public/art/enemies/capital-hardpoints.json";
import frigateFile from "../../public/art/enemies/frigate-hardpoints.json";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { ENEMY_DISPLAY_SCALE, MUZZLE_LAYOUTS } from "../data/enemy-muzzles.ts";
import { aimIndex } from "../game/enemy-art.ts";
import { ART_MANIFEST } from "../game/test-art-manifest.ts";
import {
  createEnemy,
  damageEnemy,
  type EnemyContext,
  type EnemyState,
  stepEnemy,
} from "./enemy-ai.ts";
import { drawnIndex, muzzleOffset } from "./muzzles.ts";

const at = (degrees: number) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});
const spawn = (archetype: "capital" | "fighter" | "frigate" | "retaliator"): EnemyState =>
  createEnemy(
    enemyCatalog[archetype],
    { archetype, id: "enemy", packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
const context = (state: EnemyState, player = { x: 300, y: 40 }): EnemyContext => ({
  adaSpeed: 100,
  adaWidth: 20,
  dt: 1 / 60,
  initialPackSizes: {},
  peers: [state],
  player,
  speedCapRatio: enemyEncounterTuning.speedCapRatio,
  targetable: true,
  visibility: "visible",
});
/** Display px about the hull centre to world units, as the view projects them. */
const world = (x: number, y: number) => ({ x: y + x / 2, y: y - x / 2 });

describe("drawn muzzles", () => {
  it("picks drawn frames with the renderer's rule: index i faces i * 22.5 degrees", () => {
    for (let degrees = -360; degrees <= 360; degrees += 3.7) {
      expect(drawnIndex(at(degrees))).toBe(aimIndex(at(degrees)));
    }
    expect(drawnIndex(at(22.5 * 5))).toBe(5);
  });

  it("places a shot at the pivot of the hull's drawn heading plus the drawn aim's muzzle", () => {
    const heading = frigateFile.headings[6]!;
    const pivot = heading.hardpoints.find((part) => part.id === "port")!.pivot!;
    const [tip] = frigateFile.tops.gun[11]!.muzzles;
    const half = frigateFile.frame / 2;
    const expected = world(
      (pivot[0]! + tip![0]! - half) * ENEMY_DISPLAY_SCALE,
      (pivot[1]! + tip![1]! - half) * ENEMY_DISPLAY_SCALE,
    );
    const offset = muzzleOffset(
      MUZZLE_LAYOUTS.frigate,
      "port",
      at(6 * 22.5 + 8),
      at(11 * 22.5 - 9),
      0,
    )!;
    expect(offset.x).toBeCloseTo(expected.x, 9);
    expect(offset.y).toBeCloseTo(expected.y, 9);
  });

  it("cycles a twin turret's barrels by volley", () => {
    const tips = capitalFile.tops.turret[3]!.muzzles;
    expect(tips).toHaveLength(2);
    const layout = MUZZLE_LAYOUTS.capital;
    const first = muzzleOffset(layout, "weapon-left", at(0), at(3 * 22.5), 0)!;
    const second = muzzleOffset(layout, "weapon-left", at(0), at(3 * 22.5), 1)!;
    expect(second).not.toEqual(first);
    expect(muzzleOffset(layout, "weapon-left", at(0), at(3 * 22.5), 2)).toEqual(first);
  });

  it("defines no muzzle for a turretless part, an unknown turret or a ship without that art", () => {
    expect(muzzleOffset(MUZZLE_LAYOUTS.capital, "command", at(0), at(0), 0)).toBeUndefined();
    expect(muzzleOffset(MUZZLE_LAYOUTS.frigate, "missing", at(0), at(0), 0)).toBeUndefined();
    expect(muzzleOffset(MUZZLE_LAYOUTS.retaliator, "turret", at(0), at(0), 0)).toBeUndefined();
  });

  it("fires a heavy turret from its drawn muzzle along the continuous smoothed aim", () => {
    const state = { ...spawn("frigate"), facing: at(30), position: { x: 40, y: -20 } };
    const result = stepEnemy(enemyCatalog.frigate, context(state), state);
    const shots = result.fire.filter((shot) => shot.hardpointId === "port");
    expect(shots.length).toBeGreaterThan(0);
    const aim = result.state.hardpoints.find((part) => part.id === "port")!.aim!;
    const offset = muzzleOffset(MUZZLE_LAYOUTS.frigate, "port", state.facing, aim, 0)!;
    for (const shot of shots) {
      expect(shot.origin.x).toBeCloseTo(state.position.x + offset.x, 9);
      expect(shot.origin.y).toBeCloseTo(state.position.y + offset.y, 9);
      // The direction is the smoothed aim itself, not the snapped drawn frame.
      expect(shot.aim.x).toBeCloseTo(aim.x, 12);
      expect(shot.aim.y).toBeCloseTo(aim.y, 12);
    }
    expect(Math.atan2(aim.y, aim.x) % (Math.PI / 8)).not.toBeCloseTo(0, 6);
  });

  it("keeps the model origin for ships whose art defines no muzzles", () => {
    for (const archetype of ["fighter", "retaliator"] as const) {
      // A hit engages the ship at once, so it fires on this step.
      const hit = damageEnemy(
        enemyCatalog[archetype],
        { amount: 1, hardpointId: null },
        spawn(archetype),
      );
      const state = { ...hit, position: { x: 25, y: 10 } };
      const shots = stepEnemy(
        enemyCatalog[archetype],
        context(state, { x: 125, y: 10 }),
        state,
      ).fire;
      expect(shots.length).toBeGreaterThan(0);
      for (const shot of shots) {
        expect(shot.origin).toEqual(state.position);
      }
    }
  });

  it("reads every hardpoints file Art exports, at Art's enemy display scale", () => {
    // The claim family shares the coral hardpoints files and adds the platform's.
    const files = ["../../public/art/enemies/", "../../public/art/cartwheel/enemies/"].flatMap(
      (dir) =>
        readdirSync(new URL(dir, import.meta.url)).filter((name) =>
          name.endsWith("-hardpoints.json"),
        ),
    );
    expect(Object.keys(MUZZLE_LAYOUTS).sort()).toEqual(
      [...new Set(files.map((name) => name.replace("-hardpoints.json", "")))].sort(),
    );
    const manifest = ART_MANIFEST as unknown as {
      assets: { displayWidth?: number; id: string; width: number }[];
    };
    for (const archetype of Object.keys(MUZZLE_LAYOUTS)) {
      const hull = manifest.assets.find((asset) =>
        [`enemy-${archetype}-0`, `enemy-claim-${archetype}`].includes(asset.id),
      )!;
      expect(hull.displayWidth! / hull.width).toBe(ENEMY_DISPLAY_SCALE);
    }
  });
});
