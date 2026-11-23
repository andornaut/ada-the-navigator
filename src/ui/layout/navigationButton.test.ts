import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { MODAL_STYLE } from "../modal.ts";
import { MENU_ART, PAUSE_ART } from "../pause.ts";
import { EXIT_ART, NAVIGATION_BUTTON_STYLE } from "./navigationButton.ts";

const poseX = { held: 38, press: 75, rest: 1 };
const iconY = { "exit-disc": 1, menu: 38, pause: 75 };

function art(path: string, icon: keyof typeof iconY, pose: keyof typeof poseX): string {
  const sheetPath = "/art/ui/icons/icons-35x35.svg";
  const id = pose === "rest" ? icon : `${icon}-${pose}`;
  expect(path).toBe(`${sheetPath}#${id}`);
  const sheet = readFileSync(new URL(`../../../public${sheetPath}`, import.meta.url), "utf8");
  const x = poseX[pose];
  const y = iconY[icon];
  expect(sheet).toContain(`<view id="${id}" viewBox="${x} ${y} 35 35"/>`);
  const frame = `<svg x="${x}" y="${y}" width="35" height="35" viewBox="0 0 35 35"`;
  const start = sheet.indexOf(frame);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sheet.indexOf("</svg>", start);
  expect(end).toBeGreaterThan(start);
  return sheet.slice(start, end);
}

it.each(["rest", "press", "held"] as const)(
  "draws the %s Menu pose in the Pause pose's circles with three 11x3 bars",
  (pose) => {
    const menu = art(MENU_ART[pose], "menu", pose);
    const pause = art(PAUSE_ART[pose], "pause", pose);
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
  const menu = NAVIGATION_BUTTON_STYLE.split(".ada-exit-open")[0]!;
  expect(menu).not.toMatch(/width:|height:|border:|ada-navigation-disc/u);
});

it.each(["rest", "press", "held"] as const)(
  "draws the %s Exit pose in the reviewed Pause circles",
  (pose) => {
    const exit = art(EXIT_ART[pose], "exit-disc", pose);
    expect(exit).toContain('viewBox="0 0 35 35"');
    expect(exit.match(/<circle[^>]+\/>/gu)).toEqual(
      art(PAUSE_ART[pose], "pause", pose).match(/<circle[^>]+\/>/gu),
    );
    expect(NAVIGATION_BUTTON_STYLE).toContain(`url('${EXIT_ART[pose]}')`);
  },
);

it("uses a face cue for every navigation disc while preserving the authored pose edge", () => {
  const nav = ":is(.ada-pause,.ada-exit-open):focus-visible";
  expect(MODAL_STYLE).not.toContain(".ada-pause:focus-visible");
  expect(NAVIGATION_BUTTON_STYLE).toContain(`${nav}{
  outline:none;
  box-shadow:none`);
  expect(NAVIGATION_BUTTON_STYLE).not.toMatch(/outline-offset|drop-shadow|box-shadow:0/u);
  expect(NAVIGATION_BUTTON_STYLE).toContain("var(--ada-nav-face-radius)),var(--ada-nav-pose)");
  expect(NAVIGATION_BUTTON_STYLE).toContain(`${nav}[data-pose=held]::before`);
  expect(NAVIGATION_BUTTON_STYLE).toContain("--ada-nav-focus-blend:difference");
});
