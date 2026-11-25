import { expect, it } from "vitest";

import garnet from "../../public/art/andromeda/enemies/hostileStationGarnet-hardpoints.json" with { type: "json" };
import claim from "../../public/art/cartwheel/enemies/hostileStationClaim-hardpoints.json" with { type: "json" };
import wheel from "../../public/art/cartwheel/enemies/platformWheel-hardpoints.json" with { type: "json" };
import coral from "../../public/art/enemies/hostileStationCoral-hardpoints.json" with { type: "json" };
import { ENEMY_DISPLAY_SCALE } from "./enemyMuzzles.ts";
import { SPACING_RADII } from "./enemySpacing.ts";

/** World units per display px: Ada's 18.76 px span is her 20-unit diameter. */
const WORLD_PER_DISPLAY_PX = 20 / 18.76;

it("gives each station and the platform the spacing radius of its drawn hull", () => {
  const hulls = [
    ["hostileStation", claim.hull],
    ["hostileStationAndromeda", garnet.hull],
    ["hostileStationPhantom", coral.hull],
    ["platform", wheel.hull],
  ] as const;
  for (const [design, hull] of hulls) {
    const half = (Math.max(hull.length, hull.width) / 2) * ENEMY_DISPLAY_SCALE;
    expect(SPACING_RADII[design], design).toBe(Math.round(half * WORLD_PER_DISPLAY_PX));
  }
});
