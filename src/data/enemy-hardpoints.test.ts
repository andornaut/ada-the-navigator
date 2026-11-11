import { describe, expect, it } from "vitest";

import exported from "../../tools/enemy-hardpoints.json";
import { enemyCatalog } from "./enemy-catalog.ts";
import { exportHardpoints } from "./enemy-hardpoints.ts";

describe("hardpoint export for Art", () => {
  it("matches the catalog's frigate and capital layouts and Art's retaliator mount", () => {
    // Regenerate tools/enemy-hardpoints.json from exportHardpoints() after a layout change.
    expect(exported).toEqual(exportHardpoints());
  });

  it("gives the retaliator's aimed gun an unrequired turret mount the model does not track", () => {
    expect(exportHardpoints().archetypes.retaliator).toEqual({
      hardpoints: [
        { fire: "bolt", id: "turret", offset: [0, 0], order: 0, required: false, role: "turret" },
      ],
      sizeRatio: enemyCatalog.retaliator.sizeRatio,
    });
    expect(enemyCatalog.retaliator.hardpoints).toEqual([]);
  });

  it("lists the capital's command part, two engines and four turrets in order", () => {
    const roles = exportHardpoints().archetypes.capital!.hardpoints.map((part) => part.role);
    expect(roles).toEqual(["command", "engine", "engine", "turret", "turret", "turret", "turret"]);
  });
});
