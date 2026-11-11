import { describe, expect, it } from "vitest";

import exported from "../../tools/enemy-hardpoints.json";
import { exportHardpoints } from "./enemy-hardpoints.ts";

describe("hardpoint export for Art", () => {
  it("matches the catalog's frigate and capital layouts", () => {
    // Regenerate tools/enemy-hardpoints.json from exportHardpoints() after a layout change.
    expect(exported).toEqual(exportHardpoints());
  });

  it("lists the capital's command part, two engines and four turrets in order", () => {
    const roles = exportHardpoints().archetypes.capital!.hardpoints.map((part) => part.role);
    expect(roles).toEqual(["command", "engine", "engine", "turret", "turret", "turret", "turret"]);
  });
});
