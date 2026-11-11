import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BACKGROUND_ART } from "../data/storybook.ts";
import type { Background } from "../data/types.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";
import {
  type ArtAsset,
  readStoryTransitions,
  storyBackgrounds,
  transitionSteps,
} from "./story-art.ts";
import { STORYBOOK_STYLE } from "./storybook.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  assets: ArtAsset[];
  storyTransition: string;
};
const transitionData: unknown = JSON.parse(
  readFileSync(publicFile(manifest.storyTransition), "utf8"),
);
const backgrounds = storyBackgrounds(manifest.assets);
const transitions = readStoryTransitions(manifest.assets, transitionData);
const asset = (id: string) => manifest.assets.find((entry) => entry.id === id);

// Every key the Background type allows.
const KEYS = Object.keys(BACKGROUND_ART) as Background[];

describe("storybook art", () => {
  it("resolves every background key to a manifest image on Art's 960 by 540 canvas", () => {
    for (const key of KEYS) {
      const entry = asset(BACKGROUND_ART[key]);
      expect(entry, key).toBeDefined();
      expect([entry?.displayWidth, entry?.displayHeight], key).toEqual([
        STORY_BACKGROUND.width,
        STORY_BACKGROUND.height,
      ]);
      expect(existsSync(publicFile(entry!.path)), entry!.path).toBe(true);
      expect(backgrounds[key]).toBe(entry!.path);
    }
  });

  it("joins Ada's room to the cockpit with the rock glow frames", () => {
    const steps = transitionSteps(transitions, backgrounds.adaRoom, backgrounds.cockpit, false);
    expect(steps?.map(({ url }) => url)).toEqual([
      asset("story-ada-room-glow-1")?.path,
      asset("story-ada-room-glow-2")?.path,
      asset("story-ada-room-glow-3")?.path,
      backgrounds.cockpit,
    ]);
    expect(steps?.map(({ fadeMs, holdMs }) => [fadeMs, holdMs])).toEqual([
      [160, 0],
      [160, 0],
      [200, 240],
      [0, 0],
    ]);
  });

  it("replaces the glow frames with one cross-fade under reduced motion", () => {
    expect(transitionSteps(transitions, backgrounds.adaRoom, backgrounds.cockpit, true)).toEqual([
      { fadeMs: 400, holdMs: 0, url: backgrounds.cockpit },
    ]);
  });

  it("cuts between every other pair of pages, and back from the cockpit", () => {
    for (const from of KEYS) {
      for (const to of KEYS) {
        if (from !== "adaRoom" || to !== "cockpit") {
          expect(
            transitionSteps(transitions, backgrounds[from], backgrounds[to], false),
            `${from} to ${to}`,
          ).toBeNull();
        }
      }
    }
  });

  it("leaves out a transition that names an image the manifest lacks", () => {
    const data = {
      rockGlow: {
        from: "story-ada-room",
        reducedMotion: [{ background: "cockpit", fadeMs: 400, holdMs: 0 }],
        steps: [{ background: "story-missing", fadeMs: 160, holdMs: 0 }],
      },
      version: 1,
    };
    expect(readStoryTransitions(manifest.assets, data)).toEqual([]);
  });

  it("draws the canvas at display size, centred, cover-scaled only past it, nearest neighbour", () => {
    const start = STORYBOOK_STYLE.indexOf(".ada-controls .ada-story-art{");
    const art = STORYBOOK_STYLE.slice(start, STORYBOOK_STYLE.indexOf("}", start));
    expect(art).toContain(
      "width:max(calc(var(--ada-unit) * 960px), 100cqw, calc(100cqh * 960 / 540));",
    );
    expect(art).toContain("aspect-ratio:960 / 540;");
    expect(art).toContain("left:50%;");
    expect(art).toContain("top:50%;");
    expect(art).toContain("transform:translate(-50%, -50%);");
    expect(art).toContain("image-rendering:pixelated");
  });
});
