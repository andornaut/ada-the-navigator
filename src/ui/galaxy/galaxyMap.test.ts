import { expect, it } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { units } from "../layout/css.ts";
import { GALAXY_MAP } from "../layout/galaxyMap.ts";
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

it("fits the route name pills and centres only the locked ellipsis ink", () => {
  const name = GALAXY_MAP_STYLE.match(/\.ada-controls \.ada-route-label\{([^}]+)\}/u)?.[1];
  const locked = GALAXY_MAP_STYLE.match(
    /\.ada-controls \.ada-route-label\[data-locked\]\{([^}]+)\}/u,
  )?.[1];
  expect(name).toContain(`height:${units(20)}`);
  expect(name).toContain(`padding:0 ${units(4)}`);
  expect(locked).toContain(`line-height:${units(12.2)}`);
  expect(GALAXY_MAP_STYLE).toContain(`[data-locked]{line-height:${units(11.2)}}`);
  expect(GALAXY_MAP_STYLE).toContain(`:not([data-locked]){line-height:${units(22)}}`);
  expect(locked).not.toMatch(/(?:^|[;\s])(?:height|top|transform|padding):/u);
});

it("ties the filled state cues to the marker labels and retains the unlock pulse", () => {
  for (const position of ["1", "2", "3", "4", "5", "6", "earth"]) {
    for (const state of ["[data-selected]", ":focus-visible", ":active"]) {
      expect(GALAXY_MAP_STYLE).toContain(
        `[data-position="${position}"]${state}) > [data-route-label="${position}"]`,
      );
    }
  }
  expect(GALAXY_MAP_STYLE).not.toContain(".ada-route-ring");
  expect(GALAXY_MAP_STYLE).not.toContain(".ada-route-frame");
  expect(GALAXY_MAP_STYLE).toContain(".ada-route-pulse{");
  const backing = GALAXY_MAP_STYLE.match(
    /\.ada-route-marker\[data-selected\]:not\(\[data-earth\]\) > \.ada-route-backing\{([^}]+)\}/u,
  )?.[1];
  expect(backing).toContain(`width:${units(32)}`);
  expect(backing).toContain(`height:${units(32)}`);
  expect(backing).toContain("background:#65c9bf");
  expect(GALAXY_MAP.marker.selectedBackingRadius - GALAXY_MAP.marker.disc).toBe(4);
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
