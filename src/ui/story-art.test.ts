import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { BACKGROUND_ART, SELECTOR_BACKDROP } from "../data/storybook.ts";
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

  // Each cockpit Ada's room leads into: the empty one in the prologue, the seated one at boarding.
  const COCKPITS = ["cockpit", "cockpitSeated"] as const;
  // Each rock glow: Ada's room into either cockpit, and Needle's recorder room into the seated
  // one at boarding, each through its own room's three glow frames.
  const GLOWS: readonly { cockpit: ArtBackground; frames: string; room: ArtBackground }[] = [
    ...COCKPITS.map(
      (cockpit) => ({ cockpit, frames: "story-ada-room-glow", room: "adaRoom" }) as const,
    ),
    { cockpit: "cockpitSeated", frames: "story-ada-room-recorder-glow", room: "adaRoomRecorder" },
  ] as const;
  // A composite shares its base's image, so a page on Dad's recorder room glows as the room does.
  const bases = storyBases(manifest.assets);
  const glows = (from: ArtBackground, to: ArtBackground) =>
    GLOWS.some(({ cockpit, room }) => room === (bases[from] ?? from) && cockpit === to);

  it("joins each glowing room to its cockpits with its rock glow frames", () => {
    for (const { cockpit, frames, room } of GLOWS) {
      const steps = transitionSteps(transitions, backgrounds[room], backgrounds[cockpit], false);
      expect(
        steps?.map(({ url }) => url),
        `${room} to ${cockpit}`,
      ).toEqual([
        asset(`${frames}-1`)?.path,
        asset(`${frames}-2`)?.path,
        asset(`${frames}-3`)?.path,
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
    for (const { cockpit, room } of GLOWS) {
      expect(transitionSteps(transitions, backgrounds[room], backgrounds[cockpit], true)).toEqual([
        { fadeMs: 400, holdMs: 0, url: backgrounds[cockpit] },
      ]);
    }
  });

  it("cuts between every other pair of pages, and back from the cockpit", () => {
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
});
