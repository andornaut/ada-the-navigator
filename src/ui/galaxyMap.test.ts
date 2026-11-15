import { expect, it } from "vitest";

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

it("names the selected destination and preserves current-location actions", async () => {
  const { EARTH_PANEL, destinationAction } = await import("./galaxyMap.ts");
  const galaxies = [
    { name: "Sunflower", unlocked: true },
  ] as unknown as import("./galaxyMap.ts").GalaxyMapView["galaxies"];
  const view = { flight: null, galaxies, panel: 1, ship: 1, stay: false } as const;
  expect(destinationAction(true, view, "Stay here")).toBe("Jump to Earth");
  expect(destinationAction(false, view, "Stay here")).toBe("Jump to Sunflower");
  expect(destinationAction(false, { ...view, stay: true }, "Stay here")).toBe("Stay here");
  expect(destinationAction(true, { ...view, atEarth: true }, "Stay here")).toBe("Stay here");
  expect(destinationAction(true, { ...view, stay: true }, "Stay here")).toBe("Jump to Earth");
  expect(
    destinationAction(
      false,
      { ...view, galaxies: [{ ...galaxies[0]!, unlocked: false }] },
      "Stay here",
    ),
  ).toBe("Jump");
  expect(EARTH_PANEL).toEqual({
    description: "Ada’s life on Earth. Time here stands still while she’s aboard the ship.",
    kicker: "Home",
    title: "Earth",
  });
});
