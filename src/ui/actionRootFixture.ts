import { afterEach } from "vitest";

import { registerAdaActionRoot } from "./actionRegistry.ts";

const releases: (() => void)[] = [];

/** Fixture dependency setup for an available root; production callers supply their own policy. */
export function fixtureActionRoot<T>(root: T): T {
  releases.push(registerAdaActionRoot({ permits: () => true }, root as unknown as HTMLElement));
  return root;
}

afterEach(() => {
  for (const release of releases.splice(0).reverse()) {
    release();
  }
});
