import { expect, it } from "vitest";

import {
  advanceExplorationPacing,
  commitExplorationOpportunity,
  EMPTY_EXPLORATION_PACING,
  type ExplorationPacing,
  type FreshExplorationSample,
} from "./explorationPacing.ts";

const substepsPerSecond = 64;
const fresh = {
  freshDistance: 2,
  piloting: true,
  region: { kind: "nearRoute" },
  seconds: 1 / substepsPerSecond,
} as const;

function advance(
  count: number,
  sample: FreshExplorationSample = fresh,
  state: ExplorationPacing = EMPTY_EXPLORATION_PACING,
) {
  let result: ReturnType<typeof advanceExplorationPacing> = { opportunity: undefined, state };
  for (let step = 0; step < count; step++) {
    result = advanceExplorationPacing(result.state, sample);
  }
  return result;
}

it("becomes eligible after 75 seconds of piloted fresh movement", () => {
  const before = advance(75 * substepsPerSecond - 1);
  expect(before).toEqual({
    opportunity: undefined,
    state: { freshSeconds: 75 - fresh.seconds, nextOpportunity: 0 },
  });
  const result = advanceExplorationPacing(before.state, fresh);
  expect(result).toEqual({ opportunity: 0, state: { freshSeconds: 75, nextOpportunity: 0 } });
  expect(EMPTY_EXPLORATION_PACING).toEqual({ freshSeconds: 0, nextOpportunity: 0 });
});

it("credits neither idle drift nor samples without a positive fresh movement and duration", () => {
  const { state } = advance(75 * substepsPerSecond);
  for (const sample of [
    { ...fresh, piloting: false },
    ...[0, -1, NaN, Infinity].flatMap((value) => [
      { ...fresh, freshDistance: value },
      { ...fresh, seconds: value },
    ]),
  ]) {
    const result = advanceExplorationPacing(state, sample);
    expect(result.state).toBe(state);
    expect(result.opportunity).toBeUndefined();
    expect(advanceExplorationPacing(EMPTY_EXPLORATION_PACING, sample).state).toBe(
      EMPTY_EXPLORATION_PACING,
    );
  }
});

it("paces outer travel at the caller's slower rate and rejects faster or invalid targets", () => {
  const outer = { ...fresh, region: { kind: "outer", targetSeconds: 150 } } as const;
  const half = advance(75 * substepsPerSecond, outer);
  expect(half).toEqual({
    opportunity: undefined,
    state: { freshSeconds: 37.5, nextOpportunity: 0 },
  });
  const before = advance(75 * substepsPerSecond - 1, outer, half.state);
  expect(before.opportunity).toBeUndefined();
  expect(advanceExplorationPacing(before.state, outer).opportunity).toBe(0);
  for (const targetSeconds of [0, 74, 75, Infinity, NaN]) {
    expect(
      advanceExplorationPacing(half.state, { ...outer, region: { kind: "outer", targetSeconds } })
        .state,
    ).toBe(half.state);
  }
});

it("holds one stable ordinal through failed placement and restore and consumes it once", () => {
  const { state } = advance(75 * substepsPerSecond);
  expect(advance(75 * substepsPerSecond, fresh, state)).toEqual({ opportunity: 0, state });
  const restored = JSON.parse(JSON.stringify(state)) as ExplorationPacing;
  expect(advanceExplorationPacing(restored, fresh).opportunity).toBe(0);
  expect(commitExplorationOpportunity(restored, 1)).toBe(restored);
  const committed = commitExplorationOpportunity(restored, 0);
  expect(committed).toEqual({ freshSeconds: 0, nextOpportunity: 1 });
  expect(commitExplorationOpportunity(committed, 0)).toBe(committed);
  const next = advance(75 * substepsPerSecond, fresh, committed);
  expect(next.opportunity).toBe(1);
  expect(commitExplorationOpportunity(next.state, 0)).toBe(next.state);
});
