import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { BACKGROUND_ART } from "../data/storybook.ts";
import type { ArtBackground } from "../data/types.ts";
import { boardingScene, prologueScene } from "../model/storybook.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";
import {
  type ArtAsset,
  loadStoryArt,
  readStoryTransitions,
  storyBackgroundKey,
  storyBackgrounds,
  storyBases,
  storySubjects,
  transitionSteps,
  transitionStepsForBackgrounds,
} from "./storyArt.ts";
import { STORYBOOK_STYLE } from "./storybook.ts";
import { readStoryCompositionAssets } from "./storyCompositions.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  assets: ArtAsset[];
  storyCompositions?: string;
  storyTransition: string;
};
const transitionData: unknown = JSON.parse(
  readFileSync(publicFile(manifest.storyTransition), "utf8"),
);
const assets = manifest.storyCompositions
  ? readStoryCompositionAssets(
      manifest.assets,
      JSON.parse(readFileSync(publicFile(manifest.storyCompositions), "utf8")),
    )
  : manifest.assets;
if (!assets) {
  throw new Error("Invalid shipped story compositions");
}
const backgrounds = storyBackgrounds(assets);
const transitions = readStoryTransitions(assets, transitionData);
const asset = (id: string) => assets.find((entry) => entry.id === id);

const LABELS = { next: "Next", pickUpRock: "Pick up the rock." };

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

  it("places compatibility aliases as their environment base", () => {
    expect(storyBases(manifest.assets)).toEqual({
      adaRoomMorningCats: "adaRoomMorning",
      adaRoomPartyAda: "adaRoomParty",
      adaRoomRecorderDad: "adaRoomRecorder",
      adaRoomSleep: "adaRoomNight",
      adaRoomUnpolishedCats: "adaRoomUnpolished",
      frontDoorMom: "frontDoor",
      schoolyardFriends: "schoolyard",
    });
    // An alias draws its base's image, with its base's band.
    const subjects = storySubjects(manifest.assets);
    for (const [key, base] of Object.entries(storyBases(manifest.assets))) {
      expect(backgrounds[key as ArtBackground], key).toBe(backgrounds[base]);
      expect(subjects[key as ArtBackground], key).toEqual(subjects[base]);
    }
  });

  it("places the overnight night hold on its current alias and resolves the morning to its own key", () => {
    expect(storyBackgroundKey(backgrounds, "adaRoomSleep", backgrounds.adaRoomNight!)).toBe(
      "adaRoomSleep",
    );
    expect(storyBackgroundKey(backgrounds, "adaRoomSleep", backgrounds.adaRoomMorningCats!)).toBe(
      "adaRoomMorning",
    );
    expect(storyBackgroundKey(backgrounds, null, backgrounds.adaRoomNight!)).toBe("adaRoomNight");
    expect(storyBackgroundKey(backgrounds, "adaRoomSleep", "/missing.png")).toBeNull();
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

  // Each rock glow: Ada's ordinary, invitation, recorder and party rooms into aboard, each through
  // its own room's three glow frames.
  const GLOWS: readonly { aboard: ArtBackground; frames: string; room: ArtBackground }[] = [
    { aboard: "aboard", frames: "story-ada-room-glow", room: "adaRoom" },
    { aboard: "aboard", frames: "story-ada-room-invitations-glow", room: "adaRoomInvitations" },
    { aboard: "aboard", frames: "story-ada-room-party-glow", room: "adaRoomParty" },
    { aboard: "aboard", frames: "story-ada-room-recorder-glow", room: "adaRoomRecorder" },
  ] as const;
  // A composite shares its base's image, so a page on Dad's recorder room glows as the room does.
  const bases = storyBases(assets);
  const glows = (from: ArtBackground, to: ArtBackground) =>
    GLOWS.some(({ aboard, room }) => room === (bases[from] ?? from) && aboard === to);

  it("joins each glowing room to aboard with its rock glow frames", () => {
    for (const { aboard, frames, room } of GLOWS) {
      const steps = transitionStepsForBackgrounds({ bases, transitions }, false, {
        from: room,
        to: aboard,
      });
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
        [320, 0],
        [320, 0],
        [400, 480],
        [0, 0],
      ]);
    }
  });

  it("replaces the glow frames with one cross-fade under reduced motion", () => {
    for (const { aboard, room } of GLOWS) {
      expect(
        transitionStepsForBackgrounds({ bases, transitions }, true, { from: room, to: aboard }),
      ).toEqual([{ fadeMs: 400, holdMs: 0, url: backgrounds[aboard] }]);
    }
  });

  it("cuts between every other pair of pages, and back from aboard", () => {
    for (const from of KEYS) {
      for (const to of KEYS) {
        if (!glows(from, to)) {
          expect(
            transitionStepsForBackgrounds({ bases, transitions }, false, { from, to }),
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
    expect(art).toContain("left:calc(50% + var(--ada-story-art-offset-x, 0px));");
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
    for (const announce of [false, true]) {
      const aboard = boardingScene(CONTENT, announce)
        .pages.filter(({ speaker }) => speaker)
        .map(({ background }) => background);
      expect(aboard.length).toBeGreaterThan(0);
      expect(new Set(aboard)).toEqual(new Set(["aboard"]));
    }
    expect(BACKGROUND_ART.aboard).toBe("aboard");
    expect(BACKGROUND_ART.aboardEmergency).toBe("aboard-emergency");
  });
});

describe("shared story background transitions", () => {
  const assets: ArtAsset[] = [
    { id: "story-ada-room", path: "/day.webp" },
    { id: "story-ada-room-recorder", path: "/day.webp" },
    { id: "glow", overlays: ["recorder"], path: "/day.webp" },
    {
      at: { x: 12, y: 24 },
      displayHeight: 10,
      displayWidth: 20,
      id: "recorder",
      path: "/recorder.webp",
    },
    { id: "aboard", path: "/aboard.webp" },
  ];
  const data = {
    ordinary: {
      from: "story-ada-room",
      reducedMotion: [{ background: "aboard", fadeMs: 400, holdMs: 0 }],
      steps: [{ background: "aboard", fadeMs: 160, holdMs: 0 }],
    },
    recorder: {
      from: "story-ada-room-recorder",
      reducedMotion: [{ background: "aboard", fadeMs: 400, holdMs: 0 }],
      steps: [
        { background: "glow", fadeMs: 160, holdMs: 240 },
        { background: "aboard", fadeMs: 0, holdMs: 0 },
      ],
    },
  };
  const art = { bases: {}, transitions: readStoryTransitions(assets, data) };

  it("keeps recorder layers and timing when the ordinary room shares its base URL", () => {
    const steps = transitionStepsForBackgrounds(art, false, {
      from: "adaRoomRecorder",
      to: "aboard",
    });
    expect(steps).toHaveLength(2);
    expect(steps?.[0]).toMatchObject({
      fadeMs: 160,
      holdMs: 240,
      overlays: [{ id: "recorder", url: "/recorder.webp" }],
      url: "/day.webp",
    });
    expect(
      transitionStepsForBackgrounds(art, false, { from: "adaRoom", to: "aboard" }),
    ).toHaveLength(1);
    expect(
      transitionStepsForBackgrounds(art, true, { from: "adaRoomRecorder", to: "aboard" }),
    ).toEqual([{ fadeMs: 400, holdMs: 0, url: "/aboard.webp" }]);
  });

  it("resolves an existing compatibility alias without selecting another room's transition", () => {
    expect(
      transitionStepsForBackgrounds(
        { ...art, bases: { adaRoomRecorderDad: "adaRoomRecorder" } },
        false,
        { from: "adaRoomRecorderDad", to: "aboard" },
      ),
    ).toHaveLength(2);
  });
});

it("reads the same story compositions from the caller's core manifest without fetching it again", async () => {
  const fetch = vi.fn(async (url: string) => ({
    json: async () => JSON.parse(readFileSync(publicFile(url), "utf8")),
    ok: true,
  }));
  vi.stubGlobal("fetch", fetch);
  try {
    const standalone = await loadStoryArt();
    const supplied = await loadStoryArt(manifest);
    expect(supplied).toEqual(standalone);
    expect(fetch.mock.calls.filter(([url]) => url === "/art/manifest.json")).toHaveLength(1);
    expect(supplied.backgrounds.adaRoomUnpolished).toBeTruthy();
    expect(Object.values(supplied.composites).some((layers) => layers.length > 0)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("keeps failed story sidecars optional when its root manifest is already available", async () => {
  const fetch = vi.fn(async () => ({ ok: false, status: 503 }));
  vi.stubGlobal("fetch", fetch);
  try {
    const supplied = await loadStoryArt(manifest);
    expect(supplied.transitions).toEqual([]);
    expect(supplied.holodisk).toBeNull();
    expect(supplied.overnight).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith("/art/manifest.json");
  } finally {
    vi.unstubAllGlobals();
  }
});
