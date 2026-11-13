import { describe, expect, it } from "vitest";

import { boardingScene, openingScene, resolutionScene } from "../model/storybook.ts";
import { CONTENT } from "./content.ts";
import { CHAPTER_BACKGROUNDS } from "./storybook.ts";

describe("chapter home backgrounds", () => {
  it("opens Phantom in Ada's existing room and preserves the garden resolution and night closing", () => {
    expect(CHAPTER_BACKGROUNDS[6]).toEqual({
      closing: "adaRoomNight",
      opening: "adaRoom",
      resolution: "gardenLot",
    });
    expect(openingScene(CONTENT, 6).pages.every((page) => page.background === "adaRoom")).toBe(
      true,
    );
    expect(
      resolutionScene(CONTENT, 6).pages.find((page) => page.id === "resolution")?.background,
    ).toBe("gardenLot");
    expect(
      resolutionScene(CONTENT, 6).pages.find((page) => page.id === "closing")?.background,
    ).toBe("adaRoomNight");
    expect(boardingScene(CONTENT, false).pages[0]?.background).toBe("adaRoom");
  });
});
