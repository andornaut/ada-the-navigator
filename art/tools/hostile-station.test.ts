import assert from "node:assert/strict";
import { test } from "node:test";

import { ENEMY_SIZE_RATIOS } from "../../src/data/enemyDimensions.ts";
import { HOSTILE_STATION_SIGNATURE } from "../../src/data/enemySignatures.ts";
import {
  ADA_MODEL_SPAN,
  allStatePoints,
  assembledPoints,
  lateralSpan,
  projectedBounds,
  sizeReceipts,
} from "./enemy-size.ts";
import { hostileStation, hostileStationSource } from "./hostile-station.ts";

const source = hostileStationSource();
const craft = hostileStation();

test("station uses the reviewed complete assembly and exactly one canonical normalization", () => {
  assert.ok(Math.abs(lateralSpan(assembledPoints(source)) - 266.56792604152935) < 1e-10);
  assert.ok(
    Math.abs(
      lateralSpan(assembledPoints(craft)) - ENEMY_SIZE_RATIOS.hostileStation * ADA_MODEL_SPAN,
    ) < 1e-10,
  );
  assert.equal(craft.sizeRatio, ENEMY_SIZE_RATIOS.hostileStation);
  const receipt = sizeReceipts.get("hostileStation")!;
  assert.equal(
    receipt.factor,
    (ENEMY_SIZE_RATIOS.hostileStation * ADA_MODEL_SPAN) / receipt.before,
  );
  for (const [index, part] of craft.hardpoints.entries()) {
    const original = source.hardpoints[index]!;
    const expected = part.id === HOSTILE_STATION_SIGNATURE.special.mount ? "dome" : "pod";
    assert.equal(part.model.top!.name, expected);
    assert.equal(part.model.role, "turret");
    assert.ok(part.model.capped && part.model.destroyed);
    assert.equal(part.model.jets, undefined);
    assert.ok(
      Math.abs(
        part.model.destroyed![0]!.plan[0]![0] -
          original.model.destroyed![0]!.plan[0]![0] * receipt.factor,
      ) < 1e-10,
    );
    assert.ok(
      Math.abs(
        part.model.capped![0]!.plan[0]![0] -
          original.model.capped![0]!.plan[0]![0] * receipt.factor,
      ) < 1e-10,
    );
  }
});

test("all sixteen station headings and independent turret aims retain physical frame containment", () => {
  const points = allStatePoints(craft);
  for (let heading = 0; heading < 16; heading++) {
    const bounds = projectedBounds(points, heading);
    assert.ok(
      Object.values(bounds).every((value) => Math.abs(value) < craft.frame / 2),
      `heading ${heading}`,
    );
  }
  assert.deepEqual(
    craft.mounts!.tiers.map(({ armed, positions }) => ({ armed, positions })),
    [
      { armed: 6, positions: [4, 4] },
      { armed: 7, positions: [5, 5] },
      { armed: 8, positions: [6, 6] },
    ],
  );
});
