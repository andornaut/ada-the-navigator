import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { BACKGROUND_ART, SELECTOR_BACKDROP } from "../data/storybook.ts";
import type { ArtBackground } from "../data/types.ts";
import { boardingScene, prologueScene } from "../model/storybook.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";
import {
  type ArtAsset,
  astraSpeaks,
  framePosition,
  readAstraSpeaking,
  readStoryTransitions,
  speakingFrames,
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

const LABELS = { continue: "Continue", pickUpRock: "Pick up the rock." };

// Every background drawn from Art's assets.
const KEYS = Object.keys(BACKGROUND_ART) as ArtBackground[];

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

  // Each cockpit Ada's room leads into: the empty one in the prologue, the seated one at boarding.
  const COCKPITS = ["cockpit", "cockpitSeated"] as const;

  it("joins Ada's room to either cockpit with the rock glow frames", () => {
    for (const cockpit of COCKPITS) {
      const steps = transitionSteps(transitions, backgrounds.adaRoom, backgrounds[cockpit], false);
      expect(
        steps?.map(({ url }) => url),
        cockpit,
      ).toEqual([
        asset("story-ada-room-glow-1")?.path,
        asset("story-ada-room-glow-2")?.path,
        asset("story-ada-room-glow-3")?.path,
        backgrounds[cockpit],
      ]);
      expect(steps?.map(({ fadeMs, holdMs }) => [fadeMs, holdMs])).toEqual([
        [160, 0],
        [160, 0],
        [200, 240],
        [0, 0],
      ]);
    }
  });

  it("replaces the glow frames with one cross-fade under reduced motion", () => {
    for (const cockpit of COCKPITS) {
      expect(transitionSteps(transitions, backgrounds.adaRoom, backgrounds[cockpit], true)).toEqual(
        [{ fadeMs: 400, holdMs: 0, url: backgrounds[cockpit] }],
      );
    }
  });

  it("cuts between every other pair of pages, and back from the cockpit", () => {
    for (const from of KEYS) {
      for (const to of KEYS) {
        if (from !== "adaRoom" || !(COCKPITS as readonly ArtBackground[]).includes(to)) {
          expect(
            transitionSteps(transitions, backgrounds[from], backgrounds[to], false),
            `${from} to ${to}`,
          ).toBeNull();
        }
      }
    }
  });

  it("picks each transition by its first and final images, whatever its key", () => {
    const entry = (to: string) => ({
      from: "story-ada-room",
      reducedMotion: [{ background: to, fadeMs: 400, holdMs: 0 }],
      steps: [{ background: to, fadeMs: 0, holdMs: 0 }],
    });
    const joined = readStoryTransitions(manifest.assets, {
      anyName: entry("cockpit-seated"),
      version: 1,
    });
    expect(transitionSteps(joined, backgrounds.adaRoom, backgrounds.cockpitSeated, false)).toEqual([
      { fadeMs: 0, holdMs: 0, url: backgrounds.cockpitSeated },
    ]);
    expect(transitionSteps(joined, backgrounds.adaRoom, backgrounds.cockpit, false)).toBeNull();
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

  it("uses the empty cockpit until Ada sits, then the seated one, and seats boarding at once", () => {
    const prologue = prologueScene(PROTOTYPE, LABELS).pages;
    const sits = prologue.findIndex(({ text }) => text.startsWith("Ada sits in the pilot's chair"));
    const hub = prologue.findIndex(({ questions }) => questions);
    expect(sits).toBeGreaterThan(hub);
    const arrival = prologue.findIndex(({ background }) => background === "cockpit");
    expect(prologue[arrival]?.text).toMatch(/^Light swirls around Ada and Penny/u);
    // The question hub's answer pages follow it in the list, so they stand too.
    for (const [index, page] of prologue.entries()) {
      if (index >= arrival) {
        expect(page.background, page.id).toBe(index < sits ? "cockpit" : "cockpitSeated");
      }
    }
    expect(prologue.slice(arrival, sits).some(({ id }) => id.includes(":answer:"))).toBe(true);
    for (const fromRoom of [true, false]) {
      for (const announce of [false, true]) {
        const cockpit = boardingScene(PROTOTYPE, announce, fromRoom)
          .pages.filter(({ speaker }) => speaker)
          .map(({ background }) => background);
        expect(cockpit.length).toBeGreaterThan(0);
        expect(new Set(cockpit)).toEqual(new Set(["cockpitSeated"]));
      }
    }
    expect(SELECTOR_BACKDROP).toBe("cockpitSeated");
  });

  describe("Astra speaking", () => {
    const astra = readAstraSpeaking(manifest.assets)!;

    it("places the patch at its manifest position and display size on the 960 by 540 canvas", () => {
      const entry = manifest.assets.find(({ id }) => id === "cockpit-astra") as {
        at: { x: number; y: number };
        displayHeight: number;
        displayWidth: number;
        path: string;
      };
      expect(astra.url).toBe(entry.path);
      expect(astra.box).toEqual({
        height: (entry.displayHeight / 540) * 100,
        left: (entry.at.x / 960) * 100,
        top: (entry.at.y / 540) * 100,
        width: (entry.displayWidth / 960) * 100,
      });
      // The patch lies wholly on the canvas.
      expect(entry.at.x + entry.displayWidth).toBeLessThanOrEqual(960);
      expect(entry.at.y + entry.displayHeight).toBeLessThanOrEqual(540);
      expect(astra.frameCount).toBe(4);
    });

    it("loops speak1 to speak4 at 120 ms each, and holds speak1 under reduced motion", () => {
      expect(speakingFrames(astra, false)).toEqual(
        [0, 1, 2, 3].map((frame) => ({ frame, ms: 120 })),
      );
      expect(speakingFrames(astra, true)).toEqual([{ frame: 0, ms: 120 }]);
      const positions = [0, 1, 2, 3].map((frame) => framePosition(astra, frame));
      expect(positions.every((position) => position.endsWith("%"))).toBe(true);
      [0, 100 / 3, 200 / 3, 100].forEach((expected, frame) =>
        expect(Number.parseFloat(positions[frame]!)).toBeCloseTo(expected, 6),
      );
    });

    it("animates on the cockpit pages Astra speaks and on no other page", () => {
      const pages = [
        ...prologueScene(PROTOTYPE, LABELS).pages,
        ...boardingScene(PROTOTYPE, false).pages,
      ];
      const speaking = pages.filter(astraSpeaks);
      expect(speaking.length).toBeGreaterThan(0);
      for (const page of pages) {
        expect(astraSpeaks(page), page.id).toBe(
          page.speaker === "Astra" && page.background.startsWith("cockpit"),
        );
      }
      expect(pages.some((page) => page.speaker === "Ada" && !astraSpeaks(page))).toBe(true);
      expect(astraSpeaks({ background: "park", speaker: "Astra" })).toBe(false);
      expect(astraSpeaks({ background: "cockpit" })).toBe(false);
    });
  });
});
