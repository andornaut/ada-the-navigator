import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ART_MANIFEST, CORE_MANIFEST, GALAXY_MANIFESTS } from "../testing/public-art.ts";
import { CAST, CAST_FRAMES, type CastKey, castSheet, SPEAKER_CAST, STORY_CAST } from "./cast.ts";
import { SPEAKERS } from "./conversations.ts";
import { GALAXY_ID } from "./galaxies.ts";
import { PROJECTS } from "./projects.ts";

const CONTROLS = readFileSync(new URL("../../art/controls.md", import.meta.url), "utf8");
const CONVERSATION = readFileSync(new URL("../../art/conversation.md", import.meta.url), "utf8");

// The manifest a key's sheets live in: the core one, or its galaxy's.
function homeManifest(key: CastKey): { assets: readonly { id: string; path: string }[] } {
  const { home } = CAST[key];
  if (home === "core") {
    return CORE_MANIFEST as unknown as { assets: { id: string; path: string }[] };
  }
  const sector = Number(Object.entries(GALAXY_ID).find(([, id]) => id === home)![0]);
  return GALAXY_MANIFESTS.get(sector as 1 | 2 | 3)!;
}

type Sheet = {
  frameWidth: number;
  frames: Record<string, number>;
  id: string;
  path: string;
  width: number;
};

describe("the cast", () => {
  it("gives every key both portrait sheets in its own manifest, each one neutral frame", () => {
    for (const key of Object.keys(CAST) as CastKey[]) {
      for (const compact of [false, true]) {
        const id = `${key}-portrait${compact ? "-compact" : ""}`;
        const sheet = homeManifest(key).assets.find((asset) => asset.id === id) as
          Sheet | undefined;
        expect(sheet, id).toBeDefined();
        expect(sheet!.path).toBe(castSheet(key, compact));
        expect(sheet!.width / sheet!.frameWidth).toBe(CAST_FRAMES.frames);
        expect(sheet!.frames.neutral, id).toBe(CAST_FRAMES.neutral);
        // No other galaxy carries the key's sheets.
        expect(ART_MANIFEST.assets.filter((asset) => asset.id === id)).toHaveLength(1);
      }
    }
  });

  it("names every cast key Art drew and tabs each in Art's colour", () => {
    const keys = [...CONVERSATION.matchAll(/^\| [^|]+\| [^|]+\| `([a-z]+)` +\| \(/gm)].map(
      ([, key]) => key,
    );
    expect(new Set(Object.keys(CAST))).toEqual(new Set([...keys, "grandma"]));
    for (const { name, tab } of Object.values(CAST)) {
      expect(CONTROLS).toMatch(new RegExp(`\\| ${name} tab +\\| \`${tab}\``));
    }
  });

  it("gives every speaking key a portrait: the thank-you speakers and the story's", () => {
    const speaking = new Set<CastKey>([
      ...Object.values(SPEAKER_CAST),
      ...Object.values(STORY_CAST),
    ]);
    for (const key of speaking) {
      expect(CAST).toHaveProperty(key);
      expect(homeManifest(key).assets.some(({ id }) => id === `${key}-portrait`)).toBe(true);
    }
    // Every project's thank-you speaker is cast.
    for (const { speaker } of Object.values(PROJECTS).flat()) {
      expect(SPEAKER_CAST[speaker], speaker).toBeDefined();
    }
    for (const speaker of Object.keys(SPEAKER_CAST)) {
      expect(SPEAKERS).toHaveProperty(speaker);
    }
  });

  it("shows the named characters' names in place of their role labels", () => {
    expect(
      Object.fromEntries(
        Object.entries(SPEAKER_CAST).map(([speaker, key]) => [
          SPEAKERS[speaker as keyof typeof SPEAKERS].name,
          CAST[key].name,
        ]),
      ),
    ).toEqual({
      Grower: "Clover",
      Miner: "Mica",
      Salvager: "Patch",
      Station: "Quartz",
      "Whale family": "Whale family",
      Workshop: "Rivet",
    });
  });
});
