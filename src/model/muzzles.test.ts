import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import capitalFile from "../../public/art/enemies/capital-hardpoints.json";
import frigateFile from "../../public/art/enemies/frigate-hardpoints.json";
import {
  enemyCatalog,
  type EnemyDefinition,
  type HardpointDefinition,
} from "../data/enemyCatalog.ts";
import { ENEMY_DISPLAY_SCALE, MUZZLE_ART, muzzleLayout } from "../data/enemyMuzzles.ts";
import { aimIndex } from "../game/enemyArt.ts";
import { ART_MANIFEST } from "../testing/publicArt.ts";
import {
  createEnemy,
  damageEnemy,
  type EnemyContext,
  type EnemyState,
  stepEnemy,
} from "./enemyAi.ts";
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
  adaWidth: 20,
  dt: 1 / 60,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player,
  playerVelocity: { x: 0, y: 0 },
  targetable: true,
  visibility: "visible",
});
/** Display px about the hull centre to world units, as the view projects them. */
const world = (x: number, y: number) => ({ x: y + x / 2, y: y - x / 2 });
const MUZZLE_LAYOUTS = {
  capital: muzzleLayout(enemyCatalog.capital, MUZZLE_ART.capital),
  frigate: muzzleLayout(enemyCatalog.frigate, MUZZLE_ART.frigate),
  retaliator: muzzleLayout(enemyCatalog.retaliator, MUZZLE_ART.retaliator),
};
/** A capital whose weapon hardpoints fire `weapons` by id, as a position's loadout would. */
const armed = (weapons: Record<string, string>): EnemyDefinition => ({
  ...enemyCatalog.capital,
  hardpoints: Object.entries(weapons).map(([id, weapon]): HardpointDefinition => ({
    fire: { ...enemyCatalog.capital.fire, weapon: weapon as never },
    hp: 3,
    id,
    kind: "weapon",
    offset: { x: 0, y: 0 },
  })),
});

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

  it("fires each weapon from the top it draws on its mount, the mine layer's held aft", () => {
    const layout = muzzleLayout(
      armed({
        "claw-left": "phaser",
        "stern-right": "mineLayer",
        "weapon-rear-left": "multiLaser",
      }),
      MUZZLE_ART.capital,
    )!;
    const tips = (top: string, aim: number) =>
      capitalFile.tops[top as keyof typeof capitalFile.tops][aim]!.muzzles.length;
    expect(layout.turrets.get("claw-left")!.tips[4]).toHaveLength(tips("dish", 4));
    expect(layout.turrets.get("weapon-rear-left")!.tips[4]).toHaveLength(tips("turret", 4));
    expect(layout.turrets.get("stern-right")!.aft).toBe(true);
    // Whatever the aim, the hopper's chute is the aim frame opposite the hull heading.
    const heading = 3;
    const pivot = capitalFile.headings[heading]!.hardpoints.find(
      (part) => part.id === "stern-right",
    )!.pivot!;
    const [tip] = capitalFile.tops.hopper[(heading + 8) % 16]!.muzzles;
    const half = capitalFile.frame / 2;
    const expected = world(
      (pivot[0]! + tip![0]! - half) * ENEMY_DISPLAY_SCALE,
      (pivot[1]! + tip![1]! - half) * ENEMY_DISPLAY_SCALE,
    );
    for (const aim of [0, 90, 250]) {
      const offset = muzzleOffset(layout, "stern-right", at(heading * 22.5), at(aim), 0)!;
      expect(offset.x).toBeCloseTo(expected.x, 9);
      expect(offset.y).toBeCloseTo(expected.y, 9);
    }
    // A loadout's weapon on a mount Art's tiers give another fires from its own top there.
    const moved = muzzleLayout(armed({ "claw-left": "mineLayer" }), MUZZLE_ART.capital)!;
    expect(moved.turrets.get("claw-left")!.aft).toBe(true);
    expect(moved.turrets.get("claw-left")!.tips[4]).toHaveLength(tips("hopper", 4));
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
    expect(Object.keys(MUZZLE_ART).sort()).toEqual(
      [...new Set(files.map((name) => name.replace("-hardpoints.json", "")))].sort(),
    );
    expect(Object.keys(MUZZLE_ART)).toContain("gadget");
    const manifest = ART_MANIFEST as unknown as {
      assets: { displayWidth?: number; id: string; width: number }[];
    };
    for (const archetype of Object.keys(MUZZLE_ART)) {
      const hull = manifest.assets.find((asset) =>
        [`enemy-${archetype}-0`, `enemy-claim-${archetype}`].includes(asset.id),
      )!;
      expect(hull.displayWidth! / hull.width).toBe(ENEMY_DISPLAY_SCALE);
    }
  });
});
