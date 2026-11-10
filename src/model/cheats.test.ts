import { expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { grantAllWeapons } from "./cheats.ts";
import { GameModel } from "./game.ts";

it("grants only flight weapon ownership, saves normally and remains idempotent", () => {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  model.choose("0");
  const flight = model.state.flight!;
  Object.assign(flight, {
    cargo: 12345,
    fireCooldown: 0.37,
    ownedWeapons: ["spread"],
    shield: 42,
    weapon: "spread",
  });
  const before = structuredClone(model.state);
  expect(grantAllWeapons(model.state)).toBe(true);
  expect(model.state).toEqual({
    ...before,
    flight: { ...before.flight, ownedWeapons: ["spread", "rapid", "pierce"] },
  });
  const serialized = model.save();
  expect(new GameModel(PROTOTYPE, serialized).state).toEqual(model.state);
  expect(grantAllWeapons(model.state)).toBe(true);
  expect(model.save()).toBe(serialized);
});

it("does not change a home or dialogue save and grants no permanent unlock", () => {
  const model = new GameModel(PROTOTYPE);
  const home = model.save();
  expect(grantAllWeapons(model.state)).toBe(false);
  expect(model.save()).toBe(home);
  model.startSector(1);
  const dialogue = model.save();
  expect(grantAllWeapons(model.state)).toBe(false);
  expect(model.save()).toBe(dialogue);
});
