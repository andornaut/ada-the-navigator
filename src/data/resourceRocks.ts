/** A resource rock's durability and placement class. */
export type ResourceClass = "medium" | "large";

export interface ResourceRockClass {
  readonly hp: number;
}

/**
 * Resource rock classes: a medium rock has 3 HP and a large rock has 5 HP.
 * Every third rock in a chunk or ore field is large, from a seeded start. Each rock is
 * one of the plain asteroid shapes of its class's size, whose footprints Art's resource rocks
 * share (art/asteroids.md "Resource rocks"), and is drawn as `resource-{shape}`.
 */
export const RESOURCE_ROCKS: {
  readonly classes: Readonly<Record<ResourceClass, ResourceRockClass>>;
  readonly largeEvery: number;
} = {
  classes: {
    large: { hp: 5 },
    medium: { hp: 3 },
  },
  largeEvery: 3,
};

/** The class of the rock at `ordinal` in its group's seeded pattern. */
export function resourceClass(ordinal: number): ResourceClass {
  return ordinal % RESOURCE_ROCKS.largeEvery === RESOURCE_ROCKS.largeEvery - 1 ? "large" : "medium";
}

/** A resource rock's class, medium for a rock saved without one. */
export function resourceRock(object: { resource?: ResourceClass }): ResourceRockClass {
  return RESOURCE_ROCKS.classes[object.resource ?? "medium"];
}

/** Art's resource rock for a plain asteroid shape id: `asteroid-m1` draws as `resource-m1`. */
export function resourceArtId(shape: string): string {
  return shape.replace(/^asteroid-/, "resource-");
}
