import { describe, expect, it, vi } from "vitest";

import { validExplorationState } from "./explorationState.ts";

const context = {
  chunkSize: 20,
  validRoleId: (id: string) => id === "ordinary:one" || id === "ordinary:two",
  worldSide: 200,
};
const renewal = () => ({ departed: false, distance: 0, footprint: { x: -5, y: 4 }, seconds: 0 });
const state = () => ({ renewals: { "ordinary:one": renewal() }, version: 1 });

describe("saved exploration state validation", () => {
  it("accepts canonical empty and populated states without mutating frozen input", () => {
    expect(validExplorationState(context, { renewals: {}, version: 1 })).toBe(true);
    const value = state();
    Object.freeze(value.renewals["ordinary:one"].footprint);
    Object.freeze(value.renewals["ordinary:one"]);
    Object.freeze(value.renewals);
    Object.freeze(value);
    const before = JSON.stringify(value);
    expect(validExplorationState(context, value)).toBe(true);
    expect(JSON.stringify(value)).toBe(before);
    expect(
      validExplorationState(context, {
        renewals: {
          "ordinary:one": { ...renewal(), departed: true, distance: 120.5, seconds: 0.25 },
        },
        version: 1,
      }),
    ).toBe(true);
  });

  it("requires exact root, renewal and footprint records", () => {
    const candidates: unknown[] = [
      null,
      [],
      true,
      "state",
      1,
      {},
      { ...state(), version: "1" },
      { ...state(), version: 2 },
      { ...state(), extra: 1 },
      { renewals: {} },
      { version: 1 },
      ...[null, [], 0, "roles"].map((renewals) => ({ renewals, version: 1 })),
      ...[
        null,
        [],
        0,
        "renewal",
        { ...renewal(), extra: 1 },
        { departed: false, distance: 0, seconds: 0 },
        { ...renewal(), footprint: null },
        { ...renewal(), footprint: [] },
        { ...renewal(), footprint: { x: 0 } },
        { ...renewal(), footprint: { x: 0, y: 0, z: 0 } },
      ].map((item) => ({ renewals: { "ordinary:one": item }, version: 1 })),
    ];
    for (const candidate of candidates) {
      expect(validExplorationState(context, candidate), JSON.stringify(candidate)).toBe(false);
    }
  });

  it("rejects unknown, inherited, hidden and accessor fields without evaluating getters", () => {
    const getter = vi.fn(() => 1);
    const hidden = Object.defineProperty(state(), "hidden", { value: 1 });
    const symbol = { ...state(), [Symbol("extra")]: 1 };
    const accessor = Object.defineProperty(state(), "version", { get: getter });
    const inherited = Object.assign(Object.create({ extra: 1 }), state());
    for (const candidate of [hidden, symbol, accessor, inherited]) {
      expect(validExplorationState(context, candidate)).toBe(false);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("delegates every role identity to the owner and never infers identity from coordinates", () => {
    const validRoleId = vi.fn(context.validRoleId);
    const value = {
      renewals: { "ordinary:one": renewal(), "ordinary:two": renewal() },
      version: 1,
    };
    expect(validExplorationState({ ...context, validRoleId }, value)).toBe(true);
    expect(validRoleId.mock.calls.map(([id]) => id)).toEqual(["ordinary:one", "ordinary:two"]);
    expect(validExplorationState(context, { renewals: { unknown: renewal() }, version: 1 })).toBe(
      false,
    );
    expect(validExplorationState(context, { renewals: { "0,0": renewal() }, version: 1 })).toBe(
      false,
    );
    const roles = Object.assign(Object.create(null), value.renewals);
    expect(validExplorationState(context, { renewals: roles, version: 1 })).toBe(true);
    Object.defineProperty(roles, "hidden-invalid", { value: renewal() });
    expect(validExplorationState(context, { renewals: roles, version: 1 })).toBe(false);
  });

  it("rejects aliases and non-safe-integer cells at either boundary without normalizing them", () => {
    for (const point of [
      { x: 5, y: 0 },
      { x: -6, y: 0 },
      { x: 0, y: 5 },
      { x: 0, y: -6 },
      { x: 10, y: 0 },
      { x: -0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
      { x: Number.MAX_SAFE_INTEGER + 1, y: 0 },
      { x: 0, y: Number.NaN },
      { x: Infinity, y: 0 },
      { x: "0", y: 0 },
    ]) {
      expect(
        validExplorationState(context, {
          renewals: { "ordinary:one": { ...renewal(), footprint: point } },
          version: 1,
        }),
      ).toBe(false);
    }
    expect(validExplorationState({ ...context, worldSide: 180 }, state())).toBe(false);
    expect(
      validExplorationState(
        { ...context, worldSide: 180 },
        {
          renewals: { "ordinary:one": { ...renewal(), footprint: { x: -4, y: 4 } } },
          version: 1,
        },
      ),
    ).toBe(true);
  });

  it("requires boolean departure and finite nonnegative counters, with zero counters before departure", () => {
    const candidates = [
      ...[undefined, null, "false", 0, 1].map((departed) => ({ ...renewal(), departed })),
      ...["0", null, undefined, -1, Infinity, -Infinity, NaN].flatMap((amount) => [
        { ...renewal(), departed: true, seconds: amount },
        { ...renewal(), departed: true, distance: amount },
      ]),
      { ...renewal(), seconds: 0.1 },
      { ...renewal(), distance: 0.1 },
    ];
    for (const item of candidates) {
      expect(
        validExplorationState(context, { renewals: { "ordinary:one": item }, version: 1 }),
      ).toBe(false);
    }
  });

  it("rejects invalid grid contexts rather than accepting an unbounded or partial grid", () => {
    for (const worldSide of [0, -1, Infinity, NaN, 201]) {
      expect(validExplorationState({ ...context, worldSide }, state())).toBe(false);
    }
    for (const chunkSize of [0, -1, Infinity, NaN, 21]) {
      expect(validExplorationState({ ...context, chunkSize }, state())).toBe(false);
    }
  });
});
