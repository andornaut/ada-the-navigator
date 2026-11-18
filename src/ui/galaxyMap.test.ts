import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_MAP_STYLE } from "./galaxyMap.ts";

it("leaves the galaxy selector unframed while retaining the information panel frame", () => {
  const outer = GALAXY_MAP_STYLE.match(/\.ada-controls \.ada-route-rules\{([^}]+)\}/u)?.[1];
  const panel = GALAXY_MAP_STYLE.match(/\.ada-controls \.ada-route-panel\{([^}]+)\}/u)?.[1];
  expect(outer).toBeDefined();
  expect(outer).not.toMatch(/border|outline|box-shadow/iu);
  expect(outer).toMatch(/top:.*right:.*bottom:.*left:/su);
  expect(GALAXY_MAP_STYLE).not.toContain(".ada-route-rules::after");
  expect(panel).toContain("border:");
  expect(panel).toContain("border-image:");
});

// The destination actions as the scene reads them from content.
const labels = {
  jumpEarth: CONTENT.labels.galaxyJumpEarth!,
  jumpTo: CONTENT.labels.galaxyJumpTo!,
  lockedAction: CONTENT.labels.galaxyLockedAction!,
  stayEarth: CONTENT.labels.galaxyStayEarth!,
  stayIn: CONTENT.labels.galaxyStayIn!,
};

it("names the selected destination and preserves current-location actions", async () => {
  const { destinationAction } = await import("./galaxyMap.ts");
  const galaxies = [
    { name: "Sunflower", unlocked: true },
  ] as unknown as import("./galaxyMap.ts").GalaxyMapView["galaxies"];
  const view = { flight: null, galaxies, panel: 1, ship: 1, stay: false } as const;
  expect(destinationAction(labels, true, view)).toBe("Jump to Earth");
  expect(destinationAction(labels, false, view)).toBe("Jump to Sunflower");
  expect(destinationAction(labels, false, { ...view, stay: true })).toBe("Stay in Sunflower");
  expect(destinationAction(labels, true, { ...view, atEarth: true })).toBe("Stay on Earth");
  expect(destinationAction(labels, true, { ...view, stay: true })).toBe("Jump to Earth");
  expect(
    destinationAction(labels, false, { ...view, galaxies: [{ ...galaxies[0]!, unlocked: false }] }),
  ).toBe("Progress the story to unlock");
  expect(CONTENT.labels.galaxyEarthDescription).toBe(
    "Ada’s life on Earth. Time here stands still while she’s aboard the ship.",
  );
  expect(CONTENT.labels.galaxyEarthKicker).toBe("Home");
  expect(CONTENT.labels.galaxyEarthTitle).toBe("Earth");
});

it.each(["Sunflower", "Phantom"])(
  "does not name locked %s in either Jump or Stay state",
  async (name) => {
    const { destinationAction } = await import("./galaxyMap.ts");
    for (const stay of [false, true]) {
      const galaxies = [
        { name, unlocked: false },
      ] as unknown as import("./galaxyMap.ts").GalaxyMapView["galaxies"];
      const result = destinationAction(labels, false, {
        flight: null,
        galaxies,
        panel: 1,
        ship: 1,
        stay,
      });
      expect(result).toBe("Progress the story to unlock");
      expect(result).not.toContain(name);
    }
  },
);
