import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { MENU_ART, PAUSE_ART } from "../pause.ts";
import { NAVIGATION_BUTTON_STYLE } from "./navigationButton.ts";

const art = (path: string) =>
  readFileSync(new URL(`../../../public${path}`, import.meta.url), "utf8");

it.each(["rest", "press", "held"] as const)(
  "draws the %s Menu pose in the Pause pose's circles with three 11x3 bars",
  (pose) => {
    const menu = art(MENU_ART[pose]);
    const pause = art(PAUSE_ART[pose]);
    expect(menu.match(/<circle[^>]+\/>/gu)).toEqual(pause.match(/<circle[^>]+\/>/gu));
    expect(menu).toContain('viewBox="0 0 35 35"');
    expect(menu.match(/<rect[^>]+\/>/gu)).toEqual(
      [11, 16, 21].map((y) => `<rect x="12" y="${y}" width="11" height="3" />`),
    );
    expect(NAVIGATION_BUTTON_STYLE).toContain(`url('${MENU_ART[pose]}')`);
  },
);

it("changes only the pose artwork and stacking without a competing HUD disc or hit geometry", () => {
  expect(NAVIGATION_BUTTON_STYLE).toContain("[data-pose=press]");
  expect(NAVIGATION_BUTTON_STYLE).toContain("[data-pose=held]");
  expect(NAVIGATION_BUTTON_STYLE).not.toMatch(/width:|height:|border:|ada-navigation-disc/u);
});
