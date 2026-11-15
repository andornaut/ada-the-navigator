import { describe, expect, it } from "vitest";

import { STORY_BACKGROUND } from "./layout/storyPage.ts";
import { readOverlay, storyBackgrounds, storyComposites } from "./storyArt.ts";
import { readStoryCompositionAssets, storyOverlayCrop } from "./storyCompositions.ts";

const original = [
  { id: "story-ada-room", path: "/art/old-room.png" },
  { id: "story-ada-room-recorder", path: "/art/old-recorder.png" },
];
const fixture = () => ({
  assets: [
    {
      displayHeight: 540,
      displayWidth: 960,
      height: 1080,
      id: "day",
      path: "/art/story/day.webp",
      pixelRatio: 2,
      width: 1920,
    },
    {
      displayHeight: 20,
      displayWidth: 40,
      height: 40,
      id: "props",
      path: "/art/story/props.webp",
      pixelRatio: 2,
      width: 80,
    },
  ],
  canvas: { height: 540, width: 960 },
  scenes: {
    "story-ada-room-recorder": {
      base: "day",
      layers: [
        {
          asset: "props",
          atLogical: { x: 10, y: 20 },
          displayHeight: 20,
          displayWidth: 20,
          sourceRect: { height: 40, width: 40, x: 40, y: 0 },
        },
      ],
      subject: { bottom: 300, top: 255 },
    },
  },
  version: 1,
});

describe("story composition adapter", () => {
  it("maps encoded sheet cells into the existing scene and ordered-overlay renderer", () => {
    const assets = readStoryCompositionAssets(original, fixture());
    expect(assets).toBeDefined();
    expect(storyBackgrounds(assets!)).toMatchObject({ adaRoomRecorder: "/art/story/day.webp" });
    const overlay = storyComposites(assets!).adaRoomRecorder?.[0];
    expect(overlay).toMatchObject({
      box: {
        height: (20 / STORY_BACKGROUND.height) * 100,
        left: (10 / STORY_BACKGROUND.width) * 100,
        top: (20 / STORY_BACKGROUND.height) * 100,
        width: (20 / STORY_BACKGROUND.width) * 100,
      },
      source: { height: 40, rect: { height: 40, width: 40, x: 40, y: 0 }, width: 80 },
      url: "/art/story/props.webp",
    });
    expect(storyOverlayCrop(overlay?.source)).toEqual({
      backgroundPosition: "100% 0%",
      backgroundSize: "200% 100%",
    });
    expect(original[1]?.path).toBe("/art/old-recorder.png");
  });

  it("rejects the whole document for an out-of-sheet crop or encoded/logical unit mismatch", () => {
    const outside = fixture();
    outside.scenes["story-ada-room-recorder"].layers[0]!.sourceRect.x = 41;
    expect(readStoryCompositionAssets(original, outside)).toBeUndefined();
    const wrongUnits = fixture();
    wrongUnits.scenes["story-ada-room-recorder"].layers[0]!.displayWidth = 40;
    expect(readStoryCompositionAssets(original, wrongUnits)).toBeUndefined();
  });

  it("keeps original unlayered images compatible and rejects ambiguous source IDs", () => {
    expect(readOverlay(original, "story-ada-room")).toBeNull();
    expect(storyOverlayCrop(undefined)).toEqual({
      backgroundPosition: "0 0",
      backgroundSize: "100% 100%",
    });
    const ambiguous = fixture();
    ambiguous.assets.push(ambiguous.assets[0]!);
    expect(readStoryCompositionAssets(original, ambiguous)).toBeUndefined();
  });
});
