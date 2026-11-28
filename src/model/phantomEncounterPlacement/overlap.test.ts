import { expect, it } from "vitest";

import { enemyActorDefinition } from "../../data/enemyActorDefinition.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { createEnemy } from "../ai/index.ts";
import { outlinesContact, type Parts } from "../convex.ts";
import { enemyPhysicalBody } from "../enemyBody.ts";
import { placementOutlinesOverlap } from "./overlap.ts";

function largestPartsFirst(parts: Parts): Parts {
  const doubledArea = (part: Parts[number]) =>
    Math.abs(
      part.reduce((sum, { x, y }, index) => {
        const next = part[(index + 1) % part.length]!;
        return sum + x * next.y - y * next.x;
      }, 0),
    );
  return parts
    .map((part) => ({ area: doubledArea(part), part }))
    .sort((a, b) => b.area - a.area)
    .map(({ part }) => part);
}

it("matches contact existence at separation, touching boundaries, seams and containment", () => {
  const box: Parts = [
    [
      { x: -2, y: -2 },
      { x: 2, y: -2 },
      { x: 2, y: 2 },
      { x: -2, y: 2 },
    ],
  ];
  const seamed: Parts = [...box, ...box.map((part) => part.map(({ x, y }) => ({ x: x + 3, y })))];
  for (const obstacle of [box, seamed]) {
    for (const x of [-20, -4, -2, 0, 2, 4, 7, 20]) {
      for (const y of [-4, 0, 4]) {
        const at = { x, y };
        expect(placementOutlinesOverlap(obstacle, { x: 0, y: 0 }, box, at)).toBe(
          Boolean(outlinesContact(obstacle, { x: 0, y: 0 }, box, at)),
        );
      }
    }
  }
});

it.each(["fighter", "frigate", "capital"] as const)(
  "matches actual %s assembled geometry in intact and disabled states",
  (archetype) => {
    const definition = enemyActorDefinition(6, archetype, "placement-oracle", 2);
    const enemy = createEnemy(
      definition,
      { archetype, id: "placement-oracle", packId: null, phase: 0, weaponLevel: 2 },
      { x: 0, y: 0 },
    );
    const intact = enemyPhysicalBody(ROUTE_POSITION[6], enemy)!;
    enemy.disabled = true;
    for (const part of enemy.hardpoints) {
      part.hp = 0;
    }
    enemy.facing = { x: 1, y: 0 };
    const disabled = enemyPhysicalBody(ROUTE_POSITION[6], enemy)!;
    // Search larger capital polygons first so the oracle finds covering parts sooner at seams.
    const [oracleIntact, oracleDisabled] =
      archetype === "capital"
        ? [largestPartsFirst(intact), largestPartsFirst(disabled)]
        : [intact, disabled];
    for (const offset of [
      { x: 0, y: 0 },
      { x: 90, y: 150 },
      { x: 350, y: -150 },
    ]) {
      const origin = { x: 12000, y: -12000 };
      const at = { x: origin.x + offset.x, y: origin.y + offset.y };
      expect(placementOutlinesOverlap(intact, origin, disabled, at)).toBe(
        Boolean(outlinesContact(oracleIntact, origin, oracleDisabled, at)),
      );
    }
  },
);
