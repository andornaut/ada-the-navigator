import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
import {
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  heavyLoadout,
} from "../data/enemyCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { enemyJetsPath, readSidecars } from "../game/enemyArt.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { debrisSilhouette } from "./debrisBody.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { SHIP_HEADINGS, SHIP_NOSE, shipSilhouette } from "./nose.ts";
import { pickupOutline } from "./pickupBody.ts";
import type { SpaceObject } from "./types.ts";

type Raw = readonly (readonly (readonly number[])[])[];
const json = (path: string) => JSON.parse(readFileSync(`public/art/${path}`, "utf8")) as unknown;
/** Collision parts: at least one part of three or more finite points. */
const parts = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length > 0 &&
  (value as Raw).every(
    (part) =>
      Array.isArray(part) &&
      part.length >= 3 &&
      part.every((at) => Array.isArray(at) && at.length === 2 && at.every(Number.isFinite)),
  );
const facing = (index: number) => ({
  x: Math.cos((index * Math.PI) / 8),
  y: Math.sin((index * Math.PI) / 8),
});

describe("Art's collision data", () => {
  it("gives Ada's ship a silhouette at every one of its 64 headings", () => {
    const file = json("ship-nose.json") as { collision: unknown[] };
    expect(file.collision).toHaveLength(SHIP_HEADINGS);
    expect(file.collision.every(parts)).toBe(true);
    expect(SHIP_NOSE.collision).toHaveLength(SHIP_HEADINGS);
    for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
      expect(shipSilhouette(heading).length).toBeGreaterThan(0);
    }
  });

  it.each(["swarm", "fighter", "interceptor", "retaliator"])(
    "gives the %s a hull silhouette at all 16 headings in both families",
    (archetype) => {
      const coral = readSidecars(CORE_MANIFEST.sidecars)!;
      const claim = GALAXY_MANIFESTS.get(2)!.sidecars;
      for (const sidecars of [coral, claim]) {
        const path = enemyJetsPath(sidecars, archetype);
        expect(path).toBeDefined();
        const file = publicJson(path!) as {
          headings: { collision: unknown }[];
        };
        expect(file.headings).toHaveLength(16);
        expect(file.headings.every((heading) => parts(heading.collision))).toBe(true);
      }
    },
  );

  // Every frigate and capital design ships its own hardpoints file in the core folder.
  it.each([
    ["fleetFrigate", ["enemies"]],
    ["fleetFrigateTwin", ["enemies"]],
    ["fleetCapital", ["enemies"]],
    ["fleetCapitalBroad", ["enemies"]],
    ["fleetCapitalCrossbow", ["enemies"]],
    ["fleetCapitalForked", ["enemies"]],
    ["fleetCapitalManta", ["enemies"]],
    ["fleetCapitalOutrigger", ["enemies"]],
    ["gadget", ["enemies"]],
    ["platform", ["cartwheel/enemies"]],
  ] as const)("gives the %s its hull, hardpoint and top silhouettes", (archetype, families) => {
    for (const family of families) {
      const file = json(`${family}/${archetype}-hardpoints.json`) as {
        hardpoints: { capped?: boolean; id: string }[];
        headings: {
          collision: unknown;
          hardpoints: {
            collision: { capped?: unknown; destroyed: unknown; intact: unknown };
            hidden?: true;
            id: string;
          }[];
        }[];
        tops: Record<string, { collision: unknown }[]>;
      };
      expect(file.headings).toHaveLength(16);
      for (const heading of file.headings) {
        expect(parts(heading.collision)).toBe(true);
        expect(heading.hardpoints.map((part) => part.id).sort()).toEqual(
          file.hardpoints.map((part) => part.id).sort(),
        );
        for (const part of heading.hardpoints) {
          // A base the hull hides whole at this heading is an empty frame with no collision.
          const drawn = (value: unknown) =>
            parts(value) || (part.hidden === true && Array.isArray(value) && value.length === 0);
          expect(drawn(part.collision.intact) && drawn(part.collision.destroyed)).toBe(true);
          const capped = file.hardpoints.find(({ id }) => id === part.id)!.capped === true;
          expect(
            part.collision.capped !== undefined && drawn(part.collision.capped),
            `${part.id} capped`,
          ).toBe(capped);
        }
      }
      for (const aims of Object.values(file.tops)) {
        expect(aims).toHaveLength(16);
        expect(aims.every((aim) => parts(aim.collision))).toBe(true);
      }
    }
  });

  it("draws every enemy hull, and every heavy hardpoint and mount at every position", () => {
    for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
      const definition: EnemyDefinition = enemyCatalog[archetype];
      for (let heading = 0; heading < 16; heading++) {
        const enemy = createEnemy(
          definition,
          { archetype, id: archetype, packId: null, phase: 0 },
          { x: 0, y: 0 },
        );
        enemy.facing = facing(heading);
        expect(enemyHull(enemy), `${archetype} ${heading}`).not.toBeNull();
        const ids = [
          ...definition.hardpoints.map((part) => part.id),
          ...(definition.mounts?.fill ?? []),
        ];
        for (const position of [1, 2, 3, 4, 5, 6] as const) {
          for (const id of ids) {
            expect(
              enemyPartOutline(position, enemy, id),
              `${archetype} ${id} ${position}`,
            ).not.toBeNull();
          }
        }
      }
    }
  });

  it("outlines a mount its tier leaves unused as its capped plate and an aft top opposite the hull", () => {
    // Each route position's galaxy flies its own capital design.
    const designs = {
      1: "fleetCapital",
      2: "fleetCapitalManta",
      3: "fleetCapitalCrossbow",
      4: "fleetCapitalBroad",
      5: "fleetCapitalOutrigger",
    } as const;
    const fileAt = (position: keyof typeof designs) =>
      json(`enemies/${designs[position]}-hardpoints.json`) as {
        frame: number;
        headings: {
          hardpoints: {
            collision: Record<string, Raw>;
            id: string;
            pivot?: number[];
          }[];
        }[];
        tops: Record<string, { collision: Raw }[]>;
      };
    // A capital whose position 5 loadout carries the mine layer, a single-mount weapon dealt to
    // one of the first mounts in fill order.
    const ids = Array.from({ length: 200 }, (_, index) => `capital:${index}`);
    const id = ids.find((ship) =>
      [...heavyLoadout("capital", 5, ship)!.values()].includes("mineLayer"),
    )!;
    expect(id).toBeDefined();
    const hopper = [...heavyLoadout("capital", 5, id)!].find(
      ([, weapon]) => weapon === "mineLayer",
    )![0];
    const enemy = createEnemy(
      enemyCatalog.capital,
      { archetype: "capital", id, packId: null, phase: 0 },
      { x: 0, y: 0 },
    );
    enemy.facing = facing(3);
    enemy.aim = facing(6);
    const scale = (parts: Raw, origin: number[]) =>
      parts.map((part) =>
        part.map(([x, y]) => ({ x: (x! + origin[0]!) * 0.4375, y: (y! + origin[1]!) * 0.4375 })),
      );
    for (const position of [1, 2, 3, 4] as const) {
      const design = fileAt(position);
      const placed = design.headings[3]!.hardpoints.find((part) => part.id === "stern-right")!;
      const centre = [-design.frame / 2, -design.frame / 2];
      expect(enemyPartOutline(position, enemy, "stern-right")).toEqual(
        scale(placed.collision.capped!, centre),
      );
    }
    // The mine layer's hopper holds aim (3 + 8) mod 16 whatever the turret's aim.
    const file = fileAt(5);
    const centre = [-file.frame / 2, -file.frame / 2];
    const mount = file.headings[3]!.hardpoints.find((part) => part.id === hopper)!;
    const pivot = [mount.pivot![0]! - file.frame / 2, mount.pivot![1]! - file.frame / 2];
    const armed = [
      ...scale(mount.collision.intact!, centre),
      ...scale(file.tops.hopper![11]!.collision, pivot),
    ];
    const outline = enemyPartOutline(5, enemy, hopper)!;
    expect(outline).toHaveLength(armed.length);
    outline.flat().forEach((at, index) => {
      expect(at.x).toBeCloseTo(armed.flat()[index]!.x, 9);
      expect(at.y).toBeCloseTo(armed.flat()[index]!.y, 9);
    });
  });

  it.each(["cartwheel", "whirlpool"])("gives every %s debris frame a silhouette", (id) => {
    const file = json(`${id}/debris.json`) as {
      debris: { frames: { collision: unknown }[] }[];
    };
    expect(file.debris.length).toBeGreaterThan(0);
    for (const piece of file.debris) {
      expect(piece.frames.every((frame) => parts(frame.collision))).toBe(true);
    }
    const galaxy: GalaxyNumber = id === "cartwheel" ? 2 : 3;
    const traveling: SpaceObject = {
      hp: 3,
      id: "debris",
      kind: "debris",
      radius: 20,
      velocity: { x: 1, y: 0 },
      x: 0,
      y: 0,
    };
    expect(debrisSilhouette(galaxy, traveling)).not.toBeNull();
  });

  it("gives every pickup row of pickups.json a silhouette", () => {
    const file = json("pickups/pickups.json") as { frames: Record<string, { collision: unknown }> };
    const frames = Object.values(file.frames);
    expect(frames).toHaveLength(9);
    expect(frames.every((frame) => parts(frame.collision))).toBe(true);
  });

  it("draws the cache, Stardust, ore nugget, ammo pack and upgrade pickups with outlines", () => {
    const pickup = (extra: Partial<SpaceObject>): SpaceObject => ({
      hp: 1,
      id: "pickup",
      kind: "pickup",
      radius: 10,
      x: 0,
      y: 0,
      ...extra,
    });
    expect(pickupOutline(pickup({ amount: 5, role: "discovery" }))).not.toBeNull();
    expect(pickupOutline(pickup({ amount: 1, role: "stardust" }))).not.toBeNull();
    expect(pickupOutline(pickup({ role: "cargo" }))).not.toBeNull();
    // The ammo pack's crate, its rest frame's parts, inside the upgrade square.
    const clip = pickupOutline(pickup({ ammoPack: true }))!;
    expect(clip.length).toBeGreaterThan(0);
    expect(Math.max(...clip.flat().map((at) => Math.hypot(at.x, at.y)))).toBeLessThan(10.75);
    // The upgrade pickup's square reaches half its 1.5 px outline past its radius.
    const square = pickupOutline(pickup({ upgrade: true }))!;
    expect(Math.max(...square.flat().map((at) => at.x))).toBe(10.75);
  });

  it("gives every rock frame a silhouette", () => {
    for (const art of ASTEROID_ART.asteroids) {
      expect(art.frames.every((frame) => frame.collision.length > 0)).toBe(true);
    }
    for (const shape of ASTEROID_SHAPES.values()) {
      expect(shape.silhouette.frames).toHaveLength(shape.frames.length);
    }
  });
});
