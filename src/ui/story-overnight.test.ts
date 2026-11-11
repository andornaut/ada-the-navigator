import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { jumpHomeScene } from "../model/storybook.ts";
import {
  type ArtAsset,
  breathAlpha,
  breathKeyframes,
  overnightMs,
  overnightSeconds,
  overnightSteps,
  readOverlay,
  readOvernight,
  storyBackgrounds,
  storyComposites,
} from "./story-art.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  assets: ArtAsset[];
  storyOvernight: string;
};
const data = JSON.parse(readFileSync(publicFile(manifest.storyOvernight), "utf8")) as {
  overnight: Record<string, unknown>;
};
const overnight = readOvernight(manifest.assets, data)!;
const path = (id: string) => manifest.assets.find((entry) => entry.id === id)!.path;
const variant = (change: Record<string, unknown>) => ({
  overnight: { ...data.overnight, ...change },
});

describe("Art's overnight room", () => {
  it("links story-overnight.json from the manifest as storyOvernight", () => {
    expect(manifest.storyOvernight).toBe("/art/story-overnight.json");
    expect(overnight).not.toBeNull();
  });

  it("draws night, sleep and morning from Art's backgrounds, the sleep a composite on the night", () => {
    const backgrounds = storyBackgrounds(manifest.assets);
    expect(backgrounds.adaRoomNight).toBe("/art/story/ada-room-night.png");
    expect(backgrounds.adaRoomMorning).toBe("/art/story/ada-room-morning.png");
    expect(backgrounds.adaRoomSleep).toBe(backgrounds.adaRoomNight);
    const composites = storyComposites(manifest.assets);
    expect(Object.keys(composites)).toEqual(["adaRoomSleep"]);
    expect(composites.adaRoomSleep).toEqual([
      readOverlay(manifest.assets, "story-ada-room-sleep-figures"),
    ]);
    for (const url of [backgrounds.adaRoomNight!, backgrounds.adaRoomMorning!]) {
      expect(existsSync(publicFile(url)), url).toBe(true);
    }
  });

  it("places each overlay by its at and display size on the 960 by 540 canvas", () => {
    expect(readOverlay(manifest.assets, "story-ada-room-sleep-figures")).toEqual({
      box: {
        height: (115 / 540) * 100,
        left: (168 / 960) * 100,
        top: (325 / 540) * 100,
        width: (167 / 960) * 100,
      },
      id: "story-ada-room-sleep-figures",
      url: "/art/story/ada-room-sleep-figures.png",
    });
    expect(readOverlay(manifest.assets, "story-ada-room-sleep-glow")?.box.left).toBeCloseTo(
      (361 / 960) * 100,
      12,
    );
    expect(readOverlay(manifest.assets, "story-ada-room-night")).toBeNull();
    expect(readOverlay(manifest.assets, "missing")).toBeNull();
    for (const overlay of overnight.overlays) {
      expect(existsSync(publicFile(overlay.url)), overlay.url).toBe(true);
    }
  });

  it("fades the figures in, breathes the glow once, then cross-fades to morning over 2.5 s", () => {
    expect(overnight.from).toBe(path("story-ada-room-night"));
    expect(overnight.sleep).toBe(path("story-ada-room-sleep"));
    expect(overnight.to).toBe(path("story-ada-room-morning"));
    expect(
      overnight.steps.map((step) => [step.kind, "ms" in step ? step.ms : step.fadeMs]),
    ).toEqual([
      ["overlay", 400],
      ["breath", 1500],
      ["background", 600],
    ]);
    expect(overnightSteps(overnight, false)).toBe(overnight.steps);
    expect(overnightSeconds(overnight, false)).toBe(2.5);
  });

  it("under reduced motion shows the figures at once, holds 2 s, then one 400 ms cross-fade", () => {
    const steps = overnightSteps(overnight, true);
    expect(steps).toEqual([
      {
        fadeMs: 0,
        holdMs: 2000,
        kind: "overlay",
        overlay: readOverlay(manifest.assets, "story-ada-room-sleep-figures"),
      },
      { fadeMs: 400, holdMs: 0, kind: "background", url: path("story-ada-room-morning") },
    ]);
    // No breath: the glow holds steady.
    expect(steps.some((step) => step.kind === "breath")).toBe(false);
    expect(overnightMs(steps)).toBe(2400);
    expect(overnightSeconds(overnight, true)).toBe(2.4);
  });

  it("keeps both sleep lengths within Gameplay's 2 to 3 s, past the tap's skip delay", () => {
    for (const reduced of [false, true]) {
      expect(overnightSeconds(overnight, reduced)).toBeGreaterThanOrEqual(2);
      expect(overnightSeconds(overnight, reduced)).toBeLessThanOrEqual(3);
      expect(overnightSeconds(overnight, reduced)).toBeGreaterThan(
        OVERNIGHT_SLEEP.skipAfterSeconds,
      );
    }
  });

  it("plays over the jump-home scene's sleep page, between its night and morning pages", () => {
    const pages = jumpHomeScene("", "").pages;
    expect(pages.map(({ background, sleep }) => [background, sleep ?? false])).toEqual([
      ["adaRoomNight", false],
      ["adaRoomSleep", true],
      ["adaRoomMorning", false],
    ]);
  });

  it("breathes as (1 - cos(2 pi t / ms)) / 2: clear at both ends, full midway", () => {
    expect(breathAlpha(1500, 0)).toBe(0);
    expect(breathAlpha(1500, 750)).toBeCloseTo(1, 12);
    expect(breathAlpha(1500, 375)).toBeCloseTo(0.5, 12);
    expect(breathAlpha(1500, 1500)).toBeCloseTo(0, 12);
    const keyframes = breathKeyframes(4);
    expect(keyframes.map(({ offset }) => offset)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(keyframes.map(({ opacity }) => Number(opacity.toFixed(12)))).toEqual([
      0, 0.5, 1, 0.5, 0,
    ]);
  });

  it("reads no sequence from malformed or inconsistent data", () => {
    const steps = data.overnight.steps as Record<string, unknown>[];
    const cases: [string, unknown][] = [
      ["no overnight key", {}],
      ["an unknown background", variant({ to: "story-missing" })],
      [
        "an overlay off its manifest at",
        variant({ overlays: { "story-ada-room-sleep-figures": { at: { x: 0, y: 0 } } } }),
      ],
      [
        "a step naming an overlay it does not list",
        variant({
          steps: [{ ...steps[0], overlay: "story-ada-room-sleep-glow-2" }, ...steps.slice(1)],
        }),
      ],
      ["a total that differs from its steps", variant({ durationMs: 2600 })],
      ["a reduced total that differs", variant({ reducedMotionMs: 2500 })],
      [
        "steps that end before the morning",
        variant({ durationMs: 1900, steps: steps.slice(0, 2) }),
      ],
      ["a negative fade", variant({ steps: [{ ...steps[0], fadeMs: -1 }, ...steps.slice(1)] })],
      ["a breath of no length", variant({ steps: [steps[0], { ...steps[1], ms: 0 }, steps[2]] })],
    ];
    for (const [name, value] of cases) {
      expect(readOvernight(manifest.assets, value), name).toBeNull();
    }
  });

  it("draws a composite as its path alone when an overlay it lists is missing", () => {
    const assets = manifest.assets.map((entry) =>
      entry.id === "story-ada-room-sleep" ? { ...entry, overlays: ["story-missing"] } : entry,
    );
    expect(storyComposites(assets)).toEqual({});
    expect(storyBackgrounds(assets).adaRoomSleep).toBe(path("story-ada-room-night"));
  });
});
