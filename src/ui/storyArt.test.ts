import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { BACKGROUND_ART } from "../data/storybook.ts";
import type { ArtBackground } from "../data/types.ts";
import { boardingScene, prologueScene } from "../model/storybook.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";
import {
  type ArtAsset,
  readStoryTransitions,
  storyBackgrounds,
  storyBases,
  storySubjects,
  transitionSteps,
} from "./storyArt.ts";
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

  it("places each composite as its base: the family's pages and the sleep scene", () => {
    expect(storyBases(manifest.assets)).toEqual({
      adaRoomMorningCats: "adaRoomMorning",
      adaRoomRecorderDad: "adaRoomRecorder",
      adaRoomSleep: "adaRoomNight",
      adaRoomUnpolishedCats: "adaRoomUnpolished",
      frontDoorMom: "frontDoor",
    });
    // A composite draws its base's image, with its base's band.
    const subjects = storySubjects(manifest.assets);
    for (const [key, base] of Object.entries(storyBases(manifest.assets))) {
      expect(backgrounds[key as ArtBackground], key).toBe(backgrounds[base]);
      expect(subjects[key as ArtBackground], key).toEqual(subjects[base]);
    }
  });

  it("reads every background's subject band from its manifest entry", () => {
    const subjects = storySubjects(manifest.assets);
    for (const key of KEYS) {
      const band = (asset(BACKGROUND_ART[key]) as { subject?: unknown } | undefined)?.subject;
      expect(subjects[key], key).toEqual(band);
      expect(subjects[key]!.top, key).toBeLessThan(subjects[key]!.bottom);
    }
    const broken = manifest.assets.map((entry) =>
      entry.id === "story-park" ? { ...entry, subject: { bottom: 100, top: 200 } } : entry,
    );
    expect(storySubjects(broken)).not.toHaveProperty("park");
  });

  // Each rock glow: Ada's room, and Needle's recorder room at boarding, into aboard, each through
  // its own room's three glow frames.
  const GLOWS: readonly { aboard: ArtBackground; frames: string; room: ArtBackground }[] = [
    { aboard: "aboard", frames: "story-ada-room-glow", room: "adaRoom" },
    { aboard: "aboard", frames: "story-ada-room-recorder-glow", room: "adaRoomRecorder" },
  ] as const;
  // A composite shares its base's image, so a page on Dad's recorder room glows as the room does.
  const bases = storyBases(manifest.assets);
  const glows = (from: ArtBackground, to: ArtBackground) =>
    GLOWS.some(({ aboard, room }) => room === (bases[from] ?? from) && aboard === to);

  it("joins each glowing room to aboard with its rock glow frames", () => {
    for (const { aboard, frames, room } of GLOWS) {
      const steps = transitionSteps(transitions, backgrounds[room], backgrounds[aboard], false);
      expect(
        steps?.map(({ url }) => url),
        `${room} to ${aboard}`,
      ).toEqual([
        asset(`${frames}-1`)?.path,
        asset(`${frames}-2`)?.path,
        asset(`${frames}-3`)?.path,
        backgrounds[aboard],
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
    for (const { aboard, room } of GLOWS) {
      expect(transitionSteps(transitions, backgrounds[room], backgrounds[aboard], true)).toEqual([
        { fadeMs: 400, holdMs: 0, url: backgrounds[aboard] },
      ]);
    }
  });

  it("cuts between every other pair of pages, and back from aboard", () => {
    for (const from of KEYS) {
      for (const to of KEYS) {
        if (!glows(from, to)) {
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
      anyName: entry("aboard-emergency"),
      version: 1,
    });
    expect(
      transitionSteps(joined, backgrounds.adaRoom, backgrounds.aboardEmergency, false),
    ).toEqual([{ fadeMs: 0, holdMs: 0, url: backgrounds.aboardEmergency }]);
    expect(transitionSteps(joined, backgrounds.adaRoom, backgrounds.aboard, false)).toBeNull();
  });

  it("leaves out a transition that names an image the manifest lacks", () => {
    const data = {
      rockGlow: {
        from: "story-ada-room",
        reducedMotion: [{ background: "aboard", fadeMs: 400, holdMs: 0 }],
        steps: [{ background: "story-missing", fadeMs: 160, holdMs: 0 }],
      },
      version: 1,
    };
    expect(readStoryTransitions(manifest.assets, data)).toEqual([]);
  });

  it("draws the canvas at display size, centred across, cover-scaled only past it, nearest", () => {
    const start = STORYBOOK_STYLE.indexOf(".ada-controls .ada-story-art{");
    const art = STORYBOOK_STYLE.slice(start, STORYBOOK_STYLE.indexOf("}", start));
    expect(art).toContain(
      "width:max(calc(var(--ada-unit) * 960px), 100cqw, calc(100cqh * 960 / 540));",
    );
    expect(art).toContain("aspect-ratio:960 / 540;");
    expect(art).toContain("left:50%;");
    // Its top is the run anchor, set as each page shows.
    expect(art).toContain("top:0;");
    expect(art).toContain("transform:translateX(-50%);");
    expect(art).toContain("image-rendering:pixelated");
  });

  it("shows aboard on every page from Ada's arrival, standing or seated, and at every boarding", () => {
    const prologue = prologueScene(CONTENT, LABELS).pages;
    const arrival = prologue.findIndex(({ background }) => background === "aboard");
    expect(prologue[arrival]?.text).toMatch(/^Light swirls around Ada and Penny/u);
    // Astra's questions, their answers and the seated pages after them share the one image.
    for (const page of prologue.slice(arrival)) {
      expect(page.background, page.id).toBe("aboard");
    }
    expect(prologue.slice(arrival).some(({ id }) => id.includes(":answer:"))).toBe(true);
    for (const fromRoom of [true, false]) {
      for (const announce of [false, true]) {
        const aboard = boardingScene(CONTENT, announce, fromRoom)
          .pages.filter(({ speaker }) => speaker)
          .map(({ background }) => background);
        expect(aboard.length).toBeGreaterThan(0);
        expect(new Set(aboard)).toEqual(new Set(["aboard"]));
      }
    }
    expect(BACKGROUND_ART.aboard).toBe("aboard");
    expect(BACKGROUND_ART.aboardEmergency).toBe("aboard-emergency");
  });
});
