import { describe, expect, it } from "vitest";

import { openingScene, replayChapterScene, resolutionScene } from "../model/storybook.ts";
import { CONTENT } from "./content.ts";

const backgrounds = (pages: ReturnType<typeof openingScene>["pages"]) =>
  Object.fromEntries(pages.map(({ background, id }) => [id, background]));

describe("chapter home backgrounds", () => {
  it("uses the approved Phantom backgrounds on the authored pages and replay", () => {
    const opening = {
      opening: "adaRoomPartyAda",
      "opening:branch:0": "adaRoomPartyAda",
      "opening:branch:1": "adaRoomPartyAda",
    };
    const resolution = {
      closing: "adaRoomNightGlowing",
      "closing:0": "adaRoomNightGlowing",
      "closing:1": "adaRoomNightGlowing",
      resolution: "gardenLotRain",
      "resolution:branch:0": "gardenLotRain",
      "resolution:branch:1": "gardenLotRain",
      "resolution:rejoin:0": "gardenLotRain",
    };
    expect(backgrounds(openingScene(CONTENT, 6).pages)).toEqual(opening);
    expect(backgrounds(resolutionScene(CONTENT, 6).pages)).toEqual(resolution);
    expect(backgrounds(replayChapterScene(CONTENT, 6).pages)).toEqual({
      ...opening,
      ...resolution,
    });
  });

  it("uses the friends composite for Cartwheel's existing schoolyard pages", () => {
    expect(backgrounds(resolutionScene(CONTENT, 2).pages)).toEqual({
      closing: "schoolyardFriends",
      resolution: "schoolyardFriends",
      "resolution:branch:0": "schoolyardFriends",
      "resolution:branch:1": "schoolyardFriends",
    });
    expect(backgrounds(openingScene(CONTENT, 2).pages)).toEqual({
      opening: "schoolHallway",
      "opening:branch:0": "schoolHallway",
      "opening:branch:1": "schoolHallway",
      "opening:rejoin:0": "kitchen",
      "opening:rejoin:1": "kitchen",
    });
  });
});
