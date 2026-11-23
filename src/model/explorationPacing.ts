/** The midpoint of the approved 60 to 90 seconds of piloted fresh travel. */
export const ROUTE_OPPORTUNITY_SECONDS = 75;

export interface ExplorationPacing {
  /** Fresh travel in route-equivalent seconds, capped at one pending opportunity. */
  readonly freshSeconds: number;
  /** Local to this saved pacing record. The placement owner supplies the actual POI identity. */
  readonly nextOpportunity: number;
}

export const EMPTY_EXPLORATION_PACING: ExplorationPacing = Object.freeze({
  freshSeconds: 0,
  nextOpportunity: 0,
});

type ExplorationRegion =
  { readonly kind: "nearRoute" } | { readonly kind: "outer"; readonly targetSeconds: number };

export interface FreshExplorationSample {
  /** Positive delta of flight.freshDistance from one movement substep. */
  readonly freshDistance: number;
  /** Ada had a movement command in this substep. Uncommanded drift earns no credit. */
  readonly piloting: boolean;
  readonly region: ExplorationRegion;
  /** Time used by this movement substep, never a whole mixed frame or elapsed time. */
  readonly seconds: number;
}

function readyOpportunity(state: ExplorationPacing): number | undefined {
  return state.freshSeconds === ROUTE_OPPORTUNITY_SECONDS &&
    state.nextOpportunity < Number.MAX_SAFE_INTEGER
    ? state.nextOpportunity
    : undefined;
}

/** Submit only live movement substeps. The returned ordinal permits a bounded placement attempt. */
export function advanceExplorationPacing(
  state: ExplorationPacing,
  sample: FreshExplorationSample,
): { readonly opportunity: number | undefined; readonly state: ExplorationPacing } {
  if (
    !sample.piloting ||
    !Number.isFinite(sample.freshDistance) ||
    sample.freshDistance <= 0 ||
    !Number.isFinite(sample.seconds) ||
    sample.seconds <= 0
  ) {
    return { opportunity: undefined, state };
  }

  let seconds = sample.seconds;
  if (sample.region.kind === "outer") {
    const { targetSeconds } = sample.region;
    if (!Number.isFinite(targetSeconds) || targetSeconds <= ROUTE_OPPORTUNITY_SECONDS) {
      return { opportunity: undefined, state };
    }
    seconds *= ROUTE_OPPORTUNITY_SECONDS / targetSeconds;
  }

  const freshSeconds = Math.min(ROUTE_OPPORTUNITY_SECONDS, state.freshSeconds + seconds);
  const next = freshSeconds === state.freshSeconds ? state : { ...state, freshSeconds };
  return { opportunity: readyOpportunity(next), state: next };
}

/** Call after successful placement. A rejected placement retains the same pending ordinal. */
export function commitExplorationOpportunity(
  state: ExplorationPacing,
  opportunity: number,
): ExplorationPacing {
  const ready = readyOpportunity(state);
  return ready !== undefined && ready === opportunity
    ? { freshSeconds: 0, nextOpportunity: ready + 1 }
    : state;
}
