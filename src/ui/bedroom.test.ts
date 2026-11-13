import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { type Background, BACKGROUND_ART } from "../data/storybook.ts";
import { jumpHomeScene, roomBackground, roomScene } from "../model/storybook.ts";
import { bedroomBackground, bedroomTop } from "./bedroom.ts";

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
      { continue: "Continue", pickUpRock: "Pick up the rock." },
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
