import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { holodiskScene } from "../model/storybook.ts";
import { type ArtAsset, overnightSteps, readHolodisk, readOverlay } from "./storyArt.ts";
import { storyPageView } from "./storybook.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  aboardHolodisk: string;
  assets: ArtAsset[];
};
const data = JSON.parse(readFileSync(publicFile(manifest.aboardHolodisk), "utf8")) as {
  holodisk: Record<string, unknown>;
};
const holodisk = readHolodisk(manifest.assets, data)!;
const frame = (index: number) => readOverlay(manifest.assets, `aboard-holodisk-${index}`)!;
const variant = (change: Record<string, unknown>) => ({
  holodisk: { ...data.holodisk, ...change },
});

describe("Art's holodisk moment aboard", () => {
  it("links aboard-holodisk.json from the manifest as aboardHolodisk", () => {
    expect(manifest.aboardHolodisk).toBe("/art/aboard-holodisk.json");
    expect(holodisk).not.toBeNull();
    expect(holodisk.overlays).toEqual([0, 1, 2, 3].map(frame));
    for (const overlay of holodisk.overlays) {
      expect(existsSync(publicFile(overlay.url)), overlay.url).toBe(true);
    }
  });

  it("cuts through its four frames over 1650 ms, each over the last, and fades out in 200", () => {
    expect(
      holodisk.steps.map((step) => step.kind === "overlay" && [step.overlay.id, step.holdMs]),
    ).toEqual([
      ["aboard-holodisk-0", 400],
      ["aboard-holodisk-1", 250],
      ["aboard-holodisk-2", 400],
      ["aboard-holodisk-3", 600],
    ]);
    expect(holodisk.steps.every((step) => step.kind === "overlay" && step.fadeMs === 0)).toBe(true);
    expect(holodisk.durationMs).toBe(1650);
    expect(holodisk.exitFadeMs).toBe(200);
    expect(overnightSteps(holodisk, false)).toBe(holodisk.steps);
  });

  it("under reduced motion shows frame 0, then one 300 ms cross-fade to frame 3", () => {
    expect(overnightSteps(holodisk, true)).toEqual([
      { fadeMs: 0, holdMs: 0, kind: "overlay", overlay: frame(0) },
      { fadeMs: 300, holdMs: 0, kind: "overlay", overlay: frame(3) },
    ]);
    expect(holodisk.reducedMotionMs).toBe(300);
  });

  it("rejects a sequence off aboard, off its totals, misplaced or with a background step", () => {
    expect(readHolodisk(manifest.assets, variant({ background: "aboard-emergency" }))).toBeNull();
    expect(readHolodisk(manifest.assets, variant({ durationMs: 1600 }))).toBeNull();
    expect(readHolodisk(manifest.assets, variant({ reducedMotionMs: 0 }))).toBeNull();
    expect(readHolodisk(manifest.assets, variant({ exitFadeMs: -1 }))).toBeNull();
    expect(
      readHolodisk(
        manifest.assets,
        variant({ overlays: { "aboard-holodisk-0": { at: { x: 0, y: 137 } } } }),
      ),
    ).toBeNull();
    expect(
      readHolodisk(
        manifest.assets,
        variant({
          durationMs: 2250,
          steps: [
            ...(data.holodisk.steps as unknown[]),
            { background: "aboard", fadeMs: 600, holdMs: 0 },
          ],
        }),
      ),
    ).toBeNull();
    expect(readHolodisk(manifest.assets, {})).toBeNull();
  });

  it("plays on the insertion page alone", () => {
    const scene = holodiskScene(
      [
        { text: "Ada slides the holodisk into Astra's drive." },
        { speaker: "Astra", text: "Read." },
      ],
      "Memory restored.",
    );
    const views = scene.pages.map((page) => storyPageView(page, [], true, false));
    expect(views.map((view) => view.holodisk === true)).toEqual(
      scene.pages.map((_, index) => index === 0),
    );
  });
});
