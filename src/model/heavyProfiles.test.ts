import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import {
  enemyAssetKey,
  enemyGeometryKey,
  HEAVY_PROFILE_PART_CLASSES,
  PHANTOM_FLAGSHIP_ID,
  selectOrdinaryHeavyProfile,
} from "../data/enemyIdentity.ts";
import { MUZZLE_ART, muzzleArtForDefinition } from "../data/enemyMuzzles.ts";
import { createEnemy, enemyFireLine, hardpointOffset } from "./enemyAi.ts";
import { enemyHull, enemyPhysicalBody } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { GameModel } from "./game.ts";
import { restoreGameSave } from "./save.ts";

const home = { x: 5000, y: -5000 };

it.each([
  ["frigate", "narrow", "frigateNarrow"],
  ["frigate", "compact", "frigateCompact"],
  ["capital", "narrow", "capitalNarrow"],
  ["capital", "compact", "capitalCompact"],
] as const)(
  "binds %s %s to %s without changing its loadout or HP",
  (archetype, hullProfile, key) => {
    const id = "ordinary:heavy:0";
    const stock = enemyDefinition(1, archetype, id);
    const selected = enemyDefinition(1, archetype, id, 1, hullProfile);
    expect(selected).toEqual({ ...stock, assetKey: key });
    expect(muzzleArtForDefinition(selected)).toBe(MUZZLE_ART[key]);

    const identity = { archetype, id, packId: null, phase: 0 };
    const actor = createEnemy(selected, { ...identity, hullProfile }, home);
    const defaultActor = createEnemy(stock, identity, home);
    expect(enemyAssetKey(actor)).toBe(key);
    expect(enemyGeometryKey(actor)).toBe(key);
    expect(enemyEquipmentDefinition(1, actor)).toBe(selected);
    expect(enemyEquipmentDefinition(1, defaultActor)).toBe(stock);
    expect(enemyHull(actor)).not.toEqual(enemyHull(defaultActor));
    expect(enemyPhysicalBody(1, actor)).not.toEqual(enemyPhysicalBody(1, defaultActor));
    expect(HEAVY_PROFILE_PART_CLASSES[key]).toBe(archetype);

    const mounts = stock.hardpoints.filter(({ kind }) => kind === "weapon");
    const adaWidth = CONTENT.tuning.flight.shipRadius * 2;
    expect(
      mounts.map((mount) => hardpointOffset(selected, adaWidth, actor.facing, mount)),
    ).not.toEqual(
      mounts.map((mount) => hardpointOffset(stock, adaWidth, defaultActor.facing, mount)),
    );
    for (const state of [actor, defaultActor]) {
      for (const mount of state.hardpoints) {
        mount.aim = { x: 1, y: 0 };
      }
    }
    const fireLines = mounts.map(({ id }) => enemyFireLine(selected, adaWidth, id, 0, actor));
    expect(fireLines.every((line) => line !== null)).toBe(true);
    expect(fireLines).not.toEqual(
      mounts.map(({ id }) => enemyFireLine(stock, adaWidth, id, 0, defaultActor)),
    );
  },
);

it("gives each new ordinary actor a stable choice from explicit eligible profiles", () => {
  const id = "ordinary:selection";
  const identity = { archetype: "capital", id } as const;
  const choices = [undefined, "narrow", "compact"] as const;
  const first = selectOrdinaryHeavyProfile(choices, identity);
  expect(choices).toContain(first);
  expect(selectOrdinaryHeavyProfile(choices, { ...identity })).toBe(first);
  expect(selectOrdinaryHeavyProfile(["narrow"], identity)).toBe("narrow");
  expect(selectOrdinaryHeavyProfile([], identity)).toBeUndefined();
  for (const authoredId of [PHANTOM_FLAGSHIP_ID, "route:growers"]) {
    expect(selectOrdinaryHeavyProfile(["narrow"], { ...identity, id: authoredId })).toBeUndefined();
  }
  expect(enemyAssetKey({ ...identity, hullProfile: "compact", id: PHANTOM_FLAGSHIP_ID })).toBe(
    "gadget",
  );
});

it("restores explicit actors and wrecks in v14 while absent profiles keep stock identity", () => {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  const saved = model.saveDocument();
  expect(saved.version).toBe(14);
  const flight = saved.flight!;
  const archetype = "frigate";
  const hullProfile = "compact";
  const identity = { archetype, id: "ordinary:saved", packId: null, phase: 0 } as const;
  const actor = createEnemy(
    enemyDefinition(1, archetype, identity.id, 1, hullProfile),
    { ...identity, hullProfile },
    home,
  );
  flight.objects.push(
    { ...home, enemy: actor, hp: actor.hp, id: actor.id, kind: "enemy", radius: 40 },
    {
      ...home,
      hp: 1,
      id: "wreck:ordinary:wrecked",
      kind: "wreck",
      radius: 40,
      wreck: { age: 0, archetype, facing: actor.facing, hullProfile },
    },
  );
  const restored = restoreGameSave(CONTENT, saved);
  expect(restored?.flight?.objects.slice(-2)).toEqual(flight.objects.slice(-2));

  const stock = structuredClone(saved);
  stock.flight!.objects.at(-2)!.enemy = createEnemy(
    enemyDefinition(1, archetype, identity.id),
    identity,
    home,
  );
  const stockRead = restoreGameSave(CONTENT, stock)?.flight?.objects.at(-2)?.enemy;
  expect(stockRead?.hullProfile).toBeUndefined();
  expect(enemyAssetKey(stockRead!)).toBe("frigate");

  const invalid = structuredClone(saved);
  Object.assign(invalid.flight!.objects.at(-1)!.wreck!, { hullProfile: "giant" });
  expect(restoreGameSave(CONTENT, invalid)).toBeNull();
});
