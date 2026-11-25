import { expect, it } from "vitest";

import platformFile from "../../public/art/cartwheel/enemies/platform-hardpoints.json";
import capitalFile from "../../public/art/enemies/fleetCapital-hardpoints.json";
import frigateFile from "../../public/art/enemies/fleetFrigate-hardpoints.json";
import gadgetFile from "../../public/art/enemies/gadget-hardpoints.json";
import { enemyDefinition, PHANTOM_FLAGSHIP_ID } from "../data/enemyCatalog.ts";
import { enemyAssetKey, INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { ENEMY_DISPLAY_SCALE, muzzleArtForDefinition, muzzleLayout } from "../data/enemyMuzzles.ts";
import { createEnemy, damageEnemy, hardpointOffset, stepEnemy } from "./enemyAi.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { muzzleOffset } from "./muzzles.ts";

const at = (index: number) => ({
  x: Math.cos((index * Math.PI) / 8),
  y: Math.sin((index * Math.PI) / 8),
});

it("projects every raw hardpoint anchor once for each drawn hull heading", () => {
  const cases = [
    { definition: enemyDefinition(1, "frigate", "raw-frigate"), file: frigateFile },
    { definition: enemyDefinition(1, "capital", "raw-capital"), file: capitalFile },
    { definition: enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID), file: gadgetFile },
    { definition: enemyDefinition(6, "platform", "raw-platform"), file: platformFile },
  ];
  for (const { definition, file } of cases) {
    for (let index = 0; index < 16; index++) {
      for (const part of definition.hardpoints) {
        const anchor = file.headings[index]!.hardpoints.find(
          (entry) => entry.id === part.id,
        )!.anchor;
        const actual = hardpointOffset(definition, 20, at(index), part);
        expect(actual.x - actual.y).toBeCloseTo(
          (anchor[0]! - file.frame / 2) * ENEMY_DISPLAY_SCALE,
          9,
        );
        expect((actual.x + actual.y) / 2).toBeCloseTo(
          (anchor[1]! - file.frame / 2) * ENEMY_DISPLAY_SCALE,
          9,
        );
      }
    }
  }
});

it("uses each industrial primary turret while emitting one canonical Rapid shot", () => {
  const identities = Array.from({ length: 32 }, (_, index) => ({
    archetype: "retaliator" as const,
    id: `raw-industrial:${index}`,
  }));
  for (const key of INDUSTRIAL_BODY_KEYS) {
    const identity = identities.find((identity) => enemyAssetKey(identity) === key)!;
    expect(identity).toBeDefined();
    const definition = enemyDefinition(6, "retaliator", identity.id);
    const initial = createEnemy(
      definition,
      { ...identity, packId: null, phase: 0 },
      { x: 40, y: -20 },
    );
    const state = damageEnemy(definition, { amount: 1, hardpointId: null }, initial);
    const result = stepEnemy(
      definition,
      {
        adaWidth: 20,
        dt: 1 / 60,
        inPlayView: true,
        initialPackSizes: {},
        lead: 1,
        peers: [state],
        player: { x: 250, y: 40 },
        playerVelocity: { x: 0, y: 0 },
        targetable: true,
        visibility: "visible",
      },
      state,
    );
    expect(definition.assetKey).toBe(key);
    expect(state.hardpoints).toEqual([]);
    expect(result.fire).toHaveLength(1);
    const shot = result.fire[0]!;
    expect(shot.weapon).toBe("rapidMissile");
    const layout = muzzleLayout(definition, muzzleArtForDefinition(definition))!;
    expect(layout.primary!.tips.every((tips) => tips.length === 2)).toBe(true);
    const offset = muzzleOffset(layout, null, state.facing, result.state.aim!, 0)!;
    expect(shot.origin.x).toBeCloseTo(state.position.x + offset.x, 9);
    expect(shot.origin.y).toBeCloseTo(state.position.y + offset.y, 9);
  }
});

it("keeps capital and flagship part caches separate even for identical mount and top keys", () => {
  const capital = createEnemy(
    enemyDefinition(6, "capital", "raw-capital"),
    { archetype: "capital", id: "raw-capital", packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
  const flagship = createEnemy(
    enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID),
    { archetype: "capital", id: PHANTOM_FLAGSHIP_ID, packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
  const first = enemyPartOutline(6, capital, "claw-left");
  const second = enemyPartOutline(6, flagship, "claw-left");
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second).not.toEqual(first);
  expect(enemyPartOutline(6, capital, "claw-left")).toBe(first);
  expect(enemyPartOutline(6, flagship, "claw-left")).toBe(second);
});
