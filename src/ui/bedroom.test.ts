import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { type Background, BACKGROUND_ART } from "../data/storybook.ts";
import { jumpHomeScene, roomBackground, roomScene } from "../model/storybook.ts";
import { bedroomBackground, bedroomSideOffset, bedroomTop } from "./bedroom.ts";
import { PAUSE_BUTTON } from "./layout/playView.ts";
import { STORY_BACKGROUND, storyBackgroundScale } from "./layout/storyPage.ts";
import { SPACING } from "./layout/tokens.ts";

describe("shared bedroom", () => {
  const variants = Object.entries(BACKGROUND_ART)
    .filter(([, id]) => id.startsWith("story-ada-room"))
    .map(([key]) => key as Background);

  it.each([
    { height: 360, top: -180, width: 720 },
    { height: 390, top: -150, width: 844 },
    { height: 405, top: -135, width: 720 },
    { height: 720, top: 0, width: 1280 },
  ])(
    "keeps every room variant on the same covered canvas at $width x $height",
    ({ height, top, width }) => {
      expect(variants.length).toBeGreaterThan(5);
      for (const key of variants) {
        expect(bedroomTop({ height, width }, key)).toBe(top);
      }
      expect(bedroomTop({ height, width }, "aboard")).toBeNull();
    },
  );

  it("moves the tall covering canvas just far enough to clear the Menu", () => {
    const occupied = { left: (233 / 960) * 100, width: 10 };
    const view = { height: 960, width: 720 };
    const canvas = STORY_BACKGROUND.width * storyBackgroundScale(view);
    const overhang = (canvas - view.width) / 2;
    const hudLeft = 12;
    const shift = bedroomSideOffset(view, occupied, hudLeft);
    const left = (occupied.left / 100) * canvas - overhang + shift;
    const { art, hit } = PAUSE_BUTTON;
    expect(left).toBeCloseTo(hudLeft + hit.x + (hit.width + art.width) / 2 + SPACING.gap);
    expect(left + (occupied.width / 100) * canvas).toBeLessThan(view.width);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(overhang);
    expect(bedroomSideOffset({ height: 390, width: 844 }, occupied, hudLeft)).toBe(0);
  });

  it("keeps morning light through the immediate room continuation without changing the story", () => {
    const run = jumpHomeScene("Jump home", "Morning").pages;
    expect(bedroomBackground(run, "adaRoom")).toBe("adaRoomMorningCats");
    expect(bedroomBackground(run, "adaRoomNight")).toBe("adaRoomNight");
    expect(bedroomBackground(run, "adaRoomRecorder")).toBe("adaRoomRecorder");
    expect(bedroomBackground(undefined, "adaRoom")).toBe("adaRoom");
    expect(bedroomBackground([], "adaRoom")).toBe("adaRoom");
    const night = [...run, { background: "adaRoomNight" as const, id: "night", text: "Night" }];
    expect(bedroomBackground(night, "adaRoom")).toBe("adaRoomNight");
    const room = roomScene(
      CONTENT,
      { next: "Next", pickUpRock: "Pick up the rock." },
      true,
      roomBackground(run),
    );
    expect(room.pages[0]!.background).toBe("adaRoomMorningCats");
    expect(room.pages[0]!.action).toBe("Pick up the rock.");
    expect(room.pages[0]!.text).toBe(CONTENT.premise.emptyHome);
    const boardingRun = [
      ...room.pages,
      { background: "aboard" as const, id: "aboard", text: "Aboard" },
    ];
    expect(bedroomBackground(boardingRun, "adaRoom")).toBe("adaRoomMorningCats");
    expect(bedroomBackground(boardingRun, "aboard")).toBe("aboard");
    expect(bedroomBackground([], "adaRoom")).toBe("adaRoom");
  });
});
