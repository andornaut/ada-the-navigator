import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { ABOARD_HOLODISK_FRAMES } from "../../art/index.ts";
import { holodiskScene } from "../../model/storybook.ts";
import {
  type ArtAsset,
  loadStoryArt,
  overnightSteps,
  readHolodisk,
  readOverlay,
} from "./storyArt.ts";
import { storyPageView } from "./storybook.ts";

const publicFile = (path: string) => new URL(`../../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  aboardHolodisk: string;
  assets: ArtAsset[];
};
const data = JSON.parse(readFileSync(publicFile(manifest.aboardHolodisk), "utf8")) as {
  holodisk: Record<string, unknown>;
};
// Exercise the timeline reader with resolved rows for either manifest representation.
const timelineAssets = manifest.assets.map((asset) => {
  if (!ABOARD_HOLODISK_FRAMES.has(asset.id)) {
    return asset;
  }
  const { svgSheet, ...resolved } = asset;
  return svgSheet ? resolved : asset;
});
const holodisk = readHolodisk(timelineAssets, data)!;
const frame = (index: number) => readOverlay(timelineAssets, `aboard-holodisk-${index}`)!;
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
    expect(readHolodisk(timelineAssets, variant({ background: "aboard-emergency" }))).toBeNull();
    expect(readHolodisk(timelineAssets, variant({ durationMs: 1600 }))).toBeNull();
    expect(readHolodisk(timelineAssets, variant({ reducedMotionMs: 0 }))).toBeNull();
    expect(readHolodisk(timelineAssets, variant({ exitFadeMs: -1 }))).toBeNull();
    expect(
      readHolodisk(
        timelineAssets,
        variant({ overlays: { "aboard-holodisk-0": { at: { x: 0, y: 137 } } } }),
      ),
    ).toBeNull();
    expect(
      readHolodisk(
        timelineAssets,
        variant({
          durationMs: 2250,
          steps: [
            ...(data.holodisk.steps as unknown[]),
            { background: "aboard", fadeMs: 600, holdMs: 0 },
          ],
        }),
      ),
    ).toBeNull();
    expect(readHolodisk(timelineAssets, {})).toBeNull();
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

it.each([false, true])(
  "fetches one shared sheet across readers and resolves named frames atomically (missing: %s)",
  async (missing) => {
    const path = missing ? "/art/test-holodisk-missing.svg" : "/art/test-holodisk-complete.svg";
    const at = { x: 390, y: 141 };
    const ids = [...ABOARD_HOLODISK_FRAMES];
    const packed = {
      aboardHolodisk: manifest.aboardHolodisk,
      assets: timelineAssets.map((asset) =>
        ABOARD_HOLODISK_FRAMES.has(asset.id)
          ? { ...asset, at, height: 186, path, svgSheet: true as const, width: 285 }
          : asset,
      ),
    };
    const placed = variant({ overlays: Object.fromEntries(ids.map((id) => [id, { at }])) });
    const namespaceURI = "http://www.w3.org/2000/svg";
    const spec = { height: "186", viewBox: "379 133 285 186", width: "285", x: "12", y: "24" };
    const children = (missing ? ids.slice(0, -1) : ids).map((id) => ({
      attributes: [],
      getAttribute: (key: keyof typeof spec) => spec[key] ?? null,
      id,
      localName: "svg",
      namespaceURI,
      prefix: null,
    }));
    const fetch = vi.fn(async (url: string) =>
      url === path
        ? { ok: true, text: async () => "<svg/>" }
        : { json: async () => placed, ok: true },
    );
    const parseFromString = vi.fn(() => ({
      documentElement: { children, localName: "svg", namespaceURI },
    }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString = parseFromString;
      },
    );
    vi.stubGlobal(
      "XMLSerializer",
      class {
        serializeToString({ id }: { id: string }) {
          const attributes = Object.entries(spec)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
          return `<svg xmlns="${namespaceURI}" id="${id}" ${attributes}><g id="content-${id}"/></svg>`;
        }
      },
    );
    try {
      const [first, concurrent] = await Promise.all([loadStoryArt(packed), loadStoryArt(packed)]);
      expect(concurrent).toEqual(first);
      expect(await loadStoryArt(packed)).toEqual(first);
      expect(fetch.mock.calls.filter(([url]) => url === path)).toHaveLength(1);
      expect(parseFromString).toHaveBeenCalledExactlyOnceWith("<svg/>", "image/svg+xml");
      expect(readHolodisk(packed.assets, placed)).toBeNull();
      if (missing) {
        expect(first.holodisk).toBeNull();
        expect(first.backgrounds.aboard).toBeTruthy();
      } else {
        expect(first.holodisk?.overlays.map(({ id }) => id)).toEqual(ids);
        for (const overlay of first.holodisk!.overlays) {
          expect(overlay.box).toEqual({
            height: (186 / 540) * 100,
            left: (at.x / 960) * 100,
            top: (at.y / 540) * 100,
            width: (285 / 960) * 100,
          });
          expect(atob(overlay.url.split(",")[1]!)).toBe(
            `<svg xmlns="${namespaceURI}" height="186" viewBox="379 133 285 186" width="285">` +
              `<g id="content-${overlay.id}"/></svg>`,
          );
        }
        for (const reduced of [false, true]) {
          const steps = overnightSteps(first.holodisk!, reduced);
          const expected = overnightSteps(holodisk, reduced);
          const timing = (step: (typeof steps)[number]) =>
            step.kind === "overlay" && [step.overlay.id, step.fadeMs, step.holdMs];
          expect(steps.map(timing)).toEqual(expected.map(timing));
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
