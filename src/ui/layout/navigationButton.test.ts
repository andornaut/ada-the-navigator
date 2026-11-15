import { expect, it } from "vitest";

import rest from "../../../public/art/ui/icons/pause.svg?raw";
import held from "../../../public/art/ui/icons/pause-held.svg?raw";
import press from "../../../public/art/ui/icons/pause-press.svg?raw";
import { menuPoseSvg, NAVIGATION_BUTTON_STYLE } from "./navigationButton.ts";

it.each([rest, press, held])(
  "retains actual Pause pose circles and ink around the compact Menu bars",
  (pause) => {
    const svg = menuPoseSvg(pause);
    expect(svg.match(/<circle[^>]+\/>/gu)).toEqual(pause.match(/<circle[^>]+\/>/gu));
    expect(svg).toContain('viewBox="0 0 35 35"');
    expect(svg).toContain(`<g fill="${pause.match(/<path fill="([^"]+)"/u)![1]}">`);
    expect(svg.match(/<rect[^>]+\/>/gu)).toEqual(
      [11, 16, 21].map((y) => `<rect x="12" y="${y}" width="11" height="3" />`),
    );
    expect(svg).not.toContain("<path");
  },
);

it("changes only the pose artwork and stacking without a competing HUD disc or hit geometry", () => {
  expect(NAVIGATION_BUTTON_STYLE).toContain("[data-pose=press]");
  expect(NAVIGATION_BUTTON_STYLE).toContain("[data-pose=held]");
  expect(NAVIGATION_BUTTON_STYLE).not.toMatch(/width:|height:|border:|ada-navigation-disc/u);
});
