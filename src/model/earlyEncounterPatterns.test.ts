import { expect, it } from "vitest";

import { HEAVY_SIGNATURES } from "../data/enemySignatures.ts";
import {
  advanceHammerTutorial,
  authoredLanceAction,
  crossbowAllowsAttack,
  crossbowContainsAttack,
  crossbowPattern,
  crossbowSector,
  hammerAllowsMount,
  mantaEscortCommand,
  mantaEscortCourse,
  mantaEscortMayFire,
  mantaEscortPhase,
} from "./earlyEncounterPatterns.ts";

it("gives Hammer's first tell to the existing lance mount and releases the hold on loss or completion", () => {
  const lance = HEAVY_SIGNATURES.capital.lance.mount;
  const other = "weapon-right";
  expect(hammerAllowsMount({ lanceAvailable: true, phase: "ready" }, lance)).toBe(true);
  expect(hammerAllowsMount({ lanceAvailable: true, phase: "ready" }, other)).toBe(false);
  expect(hammerAllowsMount({ lanceAvailable: true, phase: "telling" }, lance)).toBe(false);
  expect(hammerAllowsMount({ lanceAvailable: true, phase: "telling" }, other)).toBe(false);
  expect(hammerAllowsMount({ lanceAvailable: false, phase: "telling" }, other)).toBe(true);
  expect(hammerAllowsMount({ lanceAvailable: true, phase: "complete" }, other)).toBe(true);
});

it("gives Manta's original escorts distinct approach, attack and reposition windows", () => {
  expect(mantaEscortPhase(0)).toMatchObject({ escort: 0, kind: "approach" });
  expect(mantaEscortPhase(1)).toMatchObject({ escort: 0, kind: "pass" });
  expect(mantaEscortPhase(2.99)).toMatchObject({ escort: 0, kind: "pass" });
  expect(mantaEscortPhase(3)).toMatchObject({ escort: null, kind: "reposition" });
  expect(mantaEscortPhase(4.5)).toMatchObject({ escort: 1, kind: "approach" });
  expect(mantaEscortPhase(5.5)).toMatchObject({ escort: 1, kind: "pass" });
  expect(mantaEscortPhase(7.49)).toMatchObject({ escort: 1, kind: "pass" });
  expect(mantaEscortPhase(7.5)).toMatchObject({ escort: null, kind: "reposition" });
  expect(mantaEscortPhase(9.49)).toMatchObject({ escort: null, kind: "reposition" });
  expect(mantaEscortPhase(9.5)).toEqual(mantaEscortPhase(0));
});

it("alternates Crossbow's warning and fire sectors around the wrapped home-to-exit bearing", () => {
  const world = { worldSide: 100 };
  const home = { x: 48, y: 0 };
  const exit = { x: -48, y: 0 };
  const at = (elapsed: number) => crossbowPattern(world, { elapsed, exit, home });
  const near = (20 * Math.PI) / 180;
  const far = (110 * Math.PI) / 180;

  expect(at(0)).toEqual({
    bearing: 0,
    fireRemaining: 0,
    laneHalfAngle: near,
    phase: "warning",
    sector: [near, far],
  });
  expect(at(1)).toMatchObject({ fireRemaining: 3, phase: "active", sector: [near, far] });
  expect(at(3.75)).toMatchObject({ fireRemaining: 0.25, phase: "active" });
  expect(at(4)).toMatchObject({ fireRemaining: 0, phase: "switch" });
  expect(at(5)).toMatchObject({ fireRemaining: 0, phase: "warning", sector: [-far, -near] });
  expect(at(6)).toMatchObject({ fireRemaining: 3, phase: "active", sector: [-far, -near] });
  expect(at(9)).toMatchObject({ fireRemaining: 0, phase: "switch" });
  expect(at(10)).toEqual(at(0));
});

it("records Hammer's actual first tell, preserves its lock snapshot, and completes on each end event", () => {
  const ready = { phase: "ready" } as const;
  const tell = {
    age: 0,
    damage: 5,
    direction: { x: 1, y: 0 },
    muzzle: { x: 20, y: 30 },
    offset: { x: 2, y: 4 },
    volley: 3,
  };
  const started = advanceHammerTutorial(ready, { kind: "started", tell });
  expect(started).toEqual({ cue: true, state: { phase: "telling", tell } });
  const lock = { ...tell, age: 0.8, direction: { x: 0, y: 1 }, muzzle: { x: 21, y: 29 } };
  const updated = advanceHammerTutorial(started.state, { kind: "updated", tell: lock });
  expect(updated).toEqual({ cue: false, state: { phase: "telling", tell: lock } });
  expect(advanceHammerTutorial(updated.state, { kind: "started", tell })).toEqual(updated);
  for (const kind of ["cancelled", "fired", "unavailable"] as const) {
    const ended = advanceHammerTutorial(updated.state, { kind });
    expect(ended).toEqual({ cue: false, state: { phase: "complete" } });
    expect(advanceHammerTutorial(ended.state, { kind: "started", tell })).toEqual(ended);
  }
  expect(advanceHammerTutorial(ready, { kind: "unavailable" }).state.phase).toBe("complete");
});

it("tracks, locks and fires the ordinary lance, cancelling for owner, mount or sector loss", () => {
  const owner = { disabled: false, hp: 2, mountHp: 1, salvaged: false };
  expect(authoredLanceAction({ age: 0.699, owner })).toBe("track");
  expect(authoredLanceAction({ age: 0.7, owner })).toBe("lock");
  expect(authoredLanceAction({ age: 0.999, owner })).toBe("lock");
  expect(authoredLanceAction({ age: 1, owner })).toBe("fire");
  for (const unavailable of [
    null,
    { ...owner, hp: 0 },
    { ...owner, disabled: true },
    { ...owner, salvaged: true },
    { ...owner, mountHp: null },
    { ...owner, mountHp: 0 },
  ]) {
    expect(authoredLanceAction({ age: 0.4, owner: unavailable })).toBe("cancel");
    expect(authoredLanceAction({ age: 0.8, owner: unavailable })).toBe("cancel");
    expect(authoredLanceAction({ age: 1, owner: unavailable })).toBe("cancel");
  }
  for (const age of [0.4, 0.8, 1]) {
    expect(authoredLanceAction({ age, owner }, false)).toBe("cancel");
  }
});

it("keeps each escort's fixed offset and changes crossing direction only on a clear current route", () => {
  const calm = { entry: { x: -3, y: 10 }, exit: { x: 3, y: 10 }, station: { x: 0, y: 12 } };
  const other = { entry: { x: 3, y: -10 }, exit: { x: -3, y: -10 }, station: { x: 0, y: -12 } };
  const opposed = { x: -2, y: 1 };
  expect(mantaEscortCourse({ current: { x: 0, y: 0 }, reverseIsClear: true }, calm)).toBe(calm);
  expect(mantaEscortCourse({ current: opposed, reverseIsClear: false }, calm)).toBe(calm);
  const biased = mantaEscortCourse({ current: opposed, reverseIsClear: true }, calm);
  expect(biased).toEqual({ ...calm, entry: calm.exit, exit: calm.entry });
  const courses = [biased, other] as const;
  const escorts = (elapsed: number, escort: 0 | 1) =>
    mantaEscortCommand({ courses, elapsed }, { escort, leader: { x: 30, y: 40 } });

  expect(escorts(0, 0)).toEqual({ kind: "approach", target: { x: 33, y: 50 } });
  expect(escorts(1, 0)).toEqual({ kind: "pass", target: { x: 27, y: 50 } });
  expect(escorts(1, 1)).toEqual({ kind: "reposition", target: { x: 30, y: 28 } });
  expect(escorts(4.5, 1)).toEqual({ kind: "approach", target: { x: 33, y: 30 } });
  expect(escorts(5.5, 1)).toEqual({ kind: "pass", target: { x: 27, y: 30 } });
  expect(mantaEscortMayFire(1, 0)).toBe(true);
  expect(mantaEscortMayFire(1, 1)).toBe(false); // The second escort cannot fill an empty first pass.
  expect(mantaEscortMayFire(3, 0)).toBe(false);
  expect(mantaEscortMayFire(5.499, 1)).toBe(false);
  expect(mantaEscortMayFire(5.5, 1)).toBe(true);
  expect(mantaEscortMayFire(7.5, 1)).toBe(false);
});

it("withholds the entire Crossbow volley for an escaping pellet, beam width or missed deadline", () => {
  const origin = { x: 0, y: 0 };
  const frame = { exit: { x: 10, y: 0 }, home: origin, vertex: origin };
  const sector = crossbowSector({}, { elapsed: 2.75 }, frame);
  const clear = { from: { x: 4, y: 6 }, screenRadius: 1, travel: { x: 10, y: 20 } };
  const escaping = { ...clear, travel: { x: 30, y: -6 } };
  const beyond = { ...clear, travel: { x: -30, y: 1 } };
  const tooWide = { ...clear, screenRadius: 5 };
  expect(crossbowContainsAttack({}, sector, clear)).toBe(true);
  expect(crossbowContainsAttack({}, sector, { ...tooWide, screenRadius: 0 })).toBe(true);
  for (const bad of [escaping, beyond, tooWide]) {
    expect(crossbowAllowsAttack({}, sector, { fireBy: 0.12, paths: [clear, bad] })).toBe(false);
  }
  expect(crossbowAllowsAttack({}, sector, { fireBy: 1, paths: [clear] })).toBe(true);
  expect(crossbowAllowsAttack({}, sector, { fireBy: 1.25, paths: [clear] })).toBe(false);
  for (const elapsed of [0, 4, 5]) {
    const closed = crossbowSector({}, { elapsed }, frame);
    expect(crossbowAllowsAttack({}, closed, { fireBy: 0, paths: [clear] })).toBe(false);
  }
  const opposite = crossbowSector({}, { elapsed: 6 }, frame);
  expect(crossbowContainsAttack({}, opposite, clear)).toBe(false);
  expect(
    crossbowContainsAttack({}, opposite, {
      ...clear,
      from: { x: 4, y: -6 },
      travel: { x: 10, y: -20 },
    }),
  ).toBe(true);
});

it("enforces the sector at the nearest muzzle image without wrapping the attack displacement", () => {
  const world = { worldSide: 100 };
  const vertex = { x: 48, y: 0 };
  const frame = { exit: { x: -48, y: 0 }, home: vertex, vertex };
  const sector = crossbowSector(world, { elapsed: 1 }, frame);
  const path = { from: { x: -48, y: 9 }, screenRadius: 1, travel: { x: 9, y: 40 } };
  expect(crossbowContainsAttack(world, sector, path)).toBe(true);
  expect(crossbowContainsAttack(world, sector, { ...path, travel: { x: 105, y: 0 } })).toBe(false);
});
