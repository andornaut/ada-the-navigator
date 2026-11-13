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
