import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";

import {
  createSourceFile,
  isFunctionDeclaration,
  isVariableStatement,
  ScriptTarget,
} from "typescript";
import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { enemyActorAvailable, type EnemyActorKind } from "../data/enemyActors.ts";
import type { EnemyDefinition } from "../data/enemyCatalog.ts";
import { enemyAssetKey, INDUSTRIAL_BODY_KEYS, PHANTOM_FLAGSHIP_ID } from "../data/enemyIdentity.ts";
import type { GalaxyNumber, WeaponLevel } from "../data/types.ts";
import { createEnemy, type EnemyState, stepEnemy } from "../model/enemyAi.ts";
import { enemyEquipmentDefinition } from "../model/enemyEquipment.ts";
import { GameModel } from "../model/game.ts";
import { restoreSave } from "../model/save.ts";
import type { Vec } from "../model/types.ts";
import { playOpening } from "../testing/launch.ts";

interface Heavy {
  archetype: EnemyActorKind;
  fire?: readonly string[];
  id?: string;
  screen: Vec;
  setup?: (enemy: EnemyState) => void;
  weaponLevel?: WeaponLevel;
}
type Fixture = (
  galaxy: GalaxyNumber,
  heavies: readonly Heavy[],
  pickups?: readonly Vec[],
) => string;

/** Evaluate only the actual fixture and projection declarations, never the browser runner. */
function fixtureFactory() {
  const script = createSourceFile(
    "browser-captures.mjs",
    readFileSync(new URL("../../tools/browser-captures.mjs", import.meta.url), "utf8"),
    ScriptTarget.Latest,
    true,
  );
  const declaration = script.statements.find(
    (node) => isFunctionDeclaration(node) && node.name?.text === "heavyFixture",
  );
  assert.ok(declaration, "production heavyFixture declaration exists");
  const support = createSourceFile(
    "browser-support.mjs",
    readFileSync(new URL("../../tools/browser-support.mjs", import.meta.url), "utf8"),
    ScriptTarget.Latest,
    true,
  );
  const projection = support.statements
    .filter(isVariableStatement)
    .flatMap((node) => node.declarationList.declarations)
    .find((node) => node.name.getText(support) === "toWorld")?.initializer;
  assert.ok(projection, "production toWorld declaration exists");
  const definitions: EnemyDefinition[] = [];
  const recordedCreate: typeof createEnemy = (definition, identity, position) => {
    definitions.push(definition);
    return createEnemy(definition, identity, position);
  };
  const build = compileFunction(
    `const toWorld = ${projection.getText(support)}; return (${declaration.getText(script)});`,
    [
      "assert",
      "GameModel",
      "CONTENT",
      "playOpening",
      "restoreSave",
      "enemyActorDefinition",
      "enemyActorAvailable",
      "createEnemy",
    ],
  );
  return {
    definitions,
    fixture: build(
      assert,
      GameModel,
      CONTENT,
      playOpening,
      restoreSave,
      enemyActorDefinition,
      enemyActorAvailable,
      recordedCreate,
    ) as Fixture,
  };
}

it("keeps default capture IDs, legacy level one and canonical restore/pickup correspondence", () => {
  const { definitions, fixture } = fixtureFactory();
  const serialized = fixture(
    1,
    [{ archetype: "frigate", screen: { x: -170, y: -20 } }],
    [{ x: 0, y: 70 }],
  );
  const saved = JSON.parse(serialized);
  const restored = restoreSave(serialized)!;
  expect(restored).toEqual(saved);
  const actor = restored.flight!.objects.find((object) => object.enemy)!;
  expect(actor.id).toBe("browser-art:frigate:-170");
  expect(actor.enemy!.weaponLevel).toBe(1);
  expect(definitions[0]).toBe(enemyEquipmentDefinition(1, actor.enemy!));
  expect(restored.flight!.objects.some((object) => object.id === "browser-art:upgrade:0")).toBe(
    true,
  );
});

it("resolves Gadget from its final saved identity and level before creating state", () => {
  const { definitions, fixture } = fixtureFactory();
  const restored = restoreSave(
    fixture(6, [
      { archetype: "capital", id: PHANTOM_FLAGSHIP_ID, screen: { x: 150, y: -40 }, weaponLevel: 3 },
    ]),
  )!;
  const actor = restored.flight!.objects.find((object) => object.enemy)!;
  const canonical = enemyEquipmentDefinition(6, actor.enemy!);
  expect(enemyAssetKey(actor.enemy!)).toBe("gadget");
  expect(actor.id).toBe(PHANTOM_FLAGSHIP_ID);
  expect(actor.enemy!.id).toBe(actor.id);
  expect(actor.enemy!.weaponLevel).toBe(3);
  expect(actor.hp).toBe(canonical.hp);
  expect(actor.radius).toBe(CONTENT.tuning.flight.shipRadius * canonical.sizeRatio);
  expect(definitions[0]).toBe(canonical);
  expect(canonical).not.toBe(enemyActorDefinition(6, "capital", PHANTOM_FLAGSHIP_ID, 1));
});

it("retains industrial variant/cache identity and one canonical Rapid shot despite three visual tips", () => {
  const identities = new Map(
    Array.from({ length: 16 }, (_, index) => `fixture-industrial:${index}`).map((id) => [
      enemyAssetKey({ archetype: "retaliator", id }),
      id,
    ]),
  );
  expect([...identities.keys()].sort()).toEqual([...INDUSTRIAL_BODY_KEYS].sort());
  for (const [variant, id] of identities) {
    const { definitions, fixture } = fixtureFactory();
    const restored = restoreSave(
      fixture(5, [{ archetype: "retaliator", id, screen: { x: -100, y: -40 }, weaponLevel: 3 }]),
    )!;
    const actor = restored.flight!.objects.find((object) => object.enemy)!;
    const enemy = actor.enemy!;
    const canonical = enemyEquipmentDefinition(5, enemy);
    expect(enemyAssetKey(enemy)).toBe(variant);
    expect(enemy.weaponLevel).toBe(3);
    expect(definitions[0]).toBe(canonical);
    const intent = stepEnemy(
      canonical,
      {
        adaWidth: CONTENT.tuning.flight.shipRadius * 2,
        dt: 1 / 60,
        inPlayView: true,
        initialPackSizes: {},
        lead: 1,
        peers: [enemy],
        player: { x: actor.x + 100, y: actor.y },
        playerVelocity: { x: 0, y: 0 },
        targetable: true,
        visibility: "visible",
      },
      enemy,
    );
    expect(intent.fire).toHaveLength(1);
    expect(intent.fire[0]!.weapon).toBe("rapidMissile");
  }
});

it("rejects unavailable actors and post-definition identity or level changes", () => {
  const { fixture } = fixtureFactory();
  expect(() => fixture(1, [{ archetype: "hostileStation", screen: { x: 0, y: 0 } }])).toThrow(
    "available",
  );
  expect(() =>
    fixture(6, [
      {
        archetype: "capital",
        screen: { x: 0, y: 0 },
        setup: (enemy) => {
          enemy.id = PHANTOM_FLAGSHIP_ID;
        },
      },
    ]),
  ).toThrow("identity");
  expect(() =>
    fixture(6, [
      {
        archetype: "capital",
        screen: { x: 0, y: 0 },
        setup: (enemy) => {
          enemy.weaponLevel = 3;
        },
      },
    ]),
  ).toThrow("weaponLevel");
});
