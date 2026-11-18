import assert from "node:assert/strict";
import { test } from "node:test";

import { ENEMY_SIZE_RATIOS } from "../../src/data/enemyDimensions.ts";
import { platform } from "./claim-jumpers.ts";
import {
  box,
  crafts,
  faces,
  type Part,
  retaliatorVariants,
  INDUSTRIAL_STEMS,
  enemyArchetype,
} from "./crafts.ts";
import {
  ADA_MODEL_SPAN,
  allStatePoints,
  assembledPoints,
  enemySizeKey,
  lateralSpan,
  normalizeHeavy,
  projectedBounds,
} from "./enemy-size.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import {
  checkMounts,
  PLATFORM_FILL,
  PLATFORM_TIERS,
  STATION_FILL,
  STATION_TIERS,
  gadget,
  type HeavyCraft,
  heavies,
  industrialHeavies,
  partOrder,
  spriteSize,
} from "./heavies.ts";
import { projectAt } from "./projection.ts";
import { check, rasterize, strictlyConvex } from "./silhouette.ts";
import { retroMouthAxis } from "./ship-model.ts";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) <= 1e-10, `${actual} differs from ${expected}`);

const models = [...crafts, retaliatorVariants.mining, ...heavies, gadget, platform];

test("each intact physical assembly meets the canonical ratio from existing Ada source wing corners", () => {
  const wings = [retroMouthAxis(-1).corner[0], retroMouthAxis(1).corner[0]];
  close(ADA_MODEL_SPAN, Math.max(...wings) - Math.min(...wings));
  for (const model of models) {
    close(
      lateralSpan(assembledPoints(model)) / ADA_MODEL_SPAN,
      ENEMY_SIZE_RATIOS[enemySizeKey(model.name)],
    );
  }
});

test("every heading, broken/capped part and independently aimed top fits the retained or grown frame", () => {
  for (const model of models) {
    const points = allStatePoints(model);
    for (let heading = 0; heading < 16; heading++) {
      const bounds = projectedBounds(points, heading);
      assert.ok(
        Object.values(bounds).every((value) => Math.abs(value) < model.frame / 2),
        `${model.name} heading${heading} clips`,
      );
    }
  }
});

test("source normalization includes a physical top, scales mount origins and inherits one transform for broken states", () => {
  const part = (width: number): Part => ({
    plan: box(-width, -1, width, 1),
    z0: 0,
    z1: 1,
    top: "#ffffff",
    side: "#ffffff",
  });
  const source: HeavyCraft = {
    frame: 96,
    hardpoints: [
      {
        id: "port",
        offset: [1, 0],
        model: {
          capped: [part(20)],
          destroyed: [part(10)],
          intact: [part(2)],
          jets: { mouths: [[10000, 10000]], width: 10000, z: 0 },
          role: "turret",
          top: { name: "gun", muzzles: [[4, -1, 1]], parts: [part(4)], z: 1 },
          z: 1,
        },
      },
    ],
    hull: [part(1)],
    hullTop: 1,
    name: "frigate",
    sizeRatio: 1,
    source: "heavies",
    title: "Test physical assembly",
  };
  const factor = (ENEMY_SIZE_RATIOS.frigate * ADA_MODEL_SPAN) / (ADA_MODEL_SPAN + 5);
  const result = normalizeHeavy(source);
  const mounted = result.hardpoints[0]!;
  close(mounted.offset[0] * result.sizeRatio * ADA_MODEL_SPAN, factor * ADA_MODEL_SPAN);
  close(mounted.model.intact[0]!.plan[0]![0], -2 * factor);
  close(mounted.model.destroyed![0]!.plan[0]![0], -10 * factor);
  close(mounted.model.capped![0]!.plan[0]![0], -20 * factor);
  close(mounted.model.top!.muzzles[0]![0], 4 * factor);
  assert.equal(mounted.id, "port");
  assert.equal(result.hardpoints.length, 1);
  assert.equal(mounted.model.top!.muzzles.length, 1);
  close(lateralSpan(assembledPoints(result)), ENEMY_SIZE_RATIOS.frigate * ADA_MODEL_SPAN);
});

test("the scaled charged-lance aperture retains convex collision under the native checker", () => {
  const craft = heavies.find(({ name }) => name === "capital")!;
  const top = craft.mounts!.weapons.chargedLance!.top;
  const aims = Array.from({ length: 16 }, (_, aim) =>
    partOrder(aim, craft.hullTop, top.parts).flatMap((part) => faces(aim, part)),
  );
  const frame = spriteSize(top.z, aims);
  const fills = aims[3]!.map(({ color, points }) => ({
    color,
    points: points.map((point) => {
      const [x, y] = projectAt(frame / 2, frame / 2 + top.z, point);
      return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
    }),
  }));
  const result = traceEnemyFills("scaled capital lance aim3", fills, [frame, frame], [0.4, 0.3]);
  assert.ok(result.collision.every(strictlyConvex));
  check(
    "scaled capital lance aim3",
    result.collision,
    rasterize(
      fills.map(({ points }) => points),
      frame,
      frame,
    ),
  );
});

test("platform and hostile station accept approved tiers and reject wrong bands, missing caps or nonweapon parts", () => {
  assert.deepEqual(PLATFORM_FILL, ["port", "starboard", "aft"]);
  assert.deepEqual(PLATFORM_TIERS, [
    { positions: [5, 5], armed: 2 },
    { positions: [6, 6], armed: 3 },
  ]);
  assert.deepEqual(STATION_FILL, [
    "weapon-0",
    "weapon-1",
    "weapon-2",
    "weapon-3",
    "weapon-4",
    "weapon-5",
    "weapon-6",
    "weapon-7",
  ]);
  assert.deepEqual(STATION_TIERS, [
    { positions: [4, 4], armed: 6 },
    { positions: [5, 5], armed: 7 },
    { positions: [6, 6], armed: 8 },
  ]);
  for (const [name, fill, tiers] of [
    ["platform", PLATFORM_FILL, PLATFORM_TIERS],
    ["hostileStation", STATION_FILL, STATION_TIERS],
  ] as const) {
    const base = heavies[0]!;
    const model = base.hardpoints.find(({ model }) => model.role === "turret")!.model;
    const craft: HeavyCraft = {
      ...base,
      name,
      hardpoints: fill.map((id) => ({
        id,
        offset: [0, 0],
        model: { ...model, role: "turret", capped: model.intact },
      })),
      mounts: { fill: [...fill], tiers: [...tiers], weapons: {} },
    };
    const layout = {
      weaponTops: {},
      tops: {},
      tiers: tiers.map(({ armed, positions }) => ({
        positions,
        mounts: Object.fromEntries(
          fill.map((id, i) => [id, i < armed ? { armed: true as const } : null]),
        ),
      })),
      headings: Array.from({ length: 16 }, () => ({
        hardpoints: fill.map((id) => ({ id, pivot: [0, 0] })),
      })),
    };
    assert.doesNotThrow(() => checkMounts(craft, layout));
    const wrongBand = structuredClone(layout);
    wrongBand.tiers[0]!.positions = [1, 2];
    assert.throws(() => checkMounts(craft, wrongBand), /position bands/);
    const missingCap = structuredClone(craft);
    delete missingCap.hardpoints.at(-1)!.model.capped;
    assert.throws(() => checkMounts(missingCap, layout), /capped state/);
    const nonweapon = structuredClone(craft);
    nonweapon.hardpoints[0]!.model.role = "engine";
    assert.throws(() => checkMounts(nonweapon, layout), /weapon hardpoint/);
    const missingPivot = structuredClone(layout);
    missingPivot.headings[0]!.hardpoints.pop();
    assert.throws(() => checkMounts(craft, missingPivot), /no pivot/);
  }
});

test("heavy top exports contain only the adopted canonical signature weapons", () => {
  const frigate = heavies.find(({ name }) => name === "frigate")!;
  const capital = heavies.find(({ name }) => name === "capital")!;
  assert.deepEqual(Object.keys(frigate.mounts!.weapons).sort(), ["heavyMissile", "laser"]);
  for (const model of [capital, gadget]) {
    assert.deepEqual(Object.keys(model.mounts!.weapons).sort(), [
      "chargedLance",
      "mineLayer",
      "scattershot",
    ]);
    assert.equal(model.mounts!.weapons.mineLayer!.aim, "aft");
    for (const weapon of Object.values(model.mounts!.weapons)) {
      assert.ok(weapon!.top.muzzles.length > 0);
    }
  }
});

test("industrial stems retain the retaliator archetype and three physical launch tips without new hardpoints", () => {
  for (const stem of Object.values(INDUSTRIAL_STEMS)) {
    const model = industrialHeavies.find(({ name }) => name === stem)!;
    assert.equal(enemyArchetype(stem), "retaliator");
    assert.deepEqual(
      model.hardpoints.map(({ id }) => id),
      ["turret"],
    );
    assert.equal(model.hardpoints[0]!.model.top!.muzzles.length, 3);
    assert.equal(model.hardpoints[0]!.model.destroyed, undefined);
  }
  assert.deepEqual(
    platform.hardpoints.map(({ id }) => id),
    ["port", "starboard", "aft"],
  );
  assert.ok(platform.hardpoints.every(({ model }) => model.role === "turret" && model.capped));
});
