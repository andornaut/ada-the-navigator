/**
 * The planner catalog's resource spawn share: every third rock is large. Used only by
 * src/model/spawnTargets.ts until ada-0380 removes the resource kind from the planner.
 */
export const RESOURCE_ROCKS: { readonly largeEvery: number } = { largeEvery: 3 };
