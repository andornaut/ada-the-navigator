import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { createBackStack, pressBack } from "./backStack.ts";
import {
  escapeTarget,
  galaxiesAvailable,
  mapShowsEmpty,
  PAUSE_ART,
  pauseActions,
  pauseButtonShown,
  pauseFrames,
  pausePose,
} from "./pause.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/ui/${path}`, import.meta.url), "utf8"));

describe("Paused card", () => {
  it("orders Map, Quests, Ship, Settings, Back to title and the primary Resume last, all available", () => {
    expect(pauseActions("flight")).toEqual([
      { available: true, id: "map", role: "secondary" },
      { available: true, id: "quests", role: "secondary" },
      { available: true, id: "ship", role: "secondary" },
      { available: true, id: "settings", role: "secondary" },
      { available: true, id: "backToTitle", role: "secondary" },
      { available: true, id: "resume", role: "primary" },
    ]);
  });

  it("has only Settings and Back to title on Ada's room page", () => {
    expect(pauseActions("room")).toEqual([
      { available: true, id: "settings", role: "secondary" },
      { available: true, id: "backToTitle", role: "secondary" },
    ]);
  });

  it("refuses the local map's Galaxies only in danger, never for towing", () => {
    expect(galaxiesAvailable(false)).toBe(true);
    expect(galaxiesAvailable(true)).toBe(false);
  });

  it("has Gameplay's strings, and no player-visible city name remains", () => {
    expect(CONTENT.labels.pause).toBe("Pause");
    expect(CONTENT.labels.pauseTitle).toBe("Paused");
    expect(CONTENT.labels.galaxies).toBe("Galaxies");
    expect(CONTENT.labels.stayHere).toBe("Stay here");
    expect(CONTENT.labels.backToTitle).toBe("Back to title");
    expect(CONTENT.labels.homeButton).toBe("Earth");
    expect(CONTENT.labels.jumpHome).toBe(
      "Astra jumped you back to Earth to recharge. Your story progress is saved.",
    );
    for (const chapter of Object.values(CONTENT.chapters)) {
      expect(chapter.objectives.at(-1)).toBe("Go home to Earth when ready.");
    }
    expect(CONTENT.labels.travelUnavailable).toBe("Unavailable while you are in danger.");
    expect(CONTENT.labels.toronto).toBeUndefined();
    expect(CONTENT.labels.travelEmpty).toBe("No destinations mapped yet.");
    expect(CONTENT.labels.map).toBe("Map");
    expect(CONTENT.labels.mapPercent).toBe("{percent}% mapped");
    expect(CONTENT.labels.travelHere).toBe("Travel here");
    expect(CONTENT.labels.travel).toBeUndefined();
    expect(CONTENT.labels.destinations).toBeUndefined();
    expect(JSON.stringify(CONTENT)).not.toContain("Toronto");
  });
});

describe("Map card", () => {
  it("says no destinations are mapped yet until a place is discovered", () => {
    expect(mapShowsEmpty([])).toBe(true);
    expect(mapShowsEmpty([{ id: "workshop", label: "Workshop" }])).toBe(false);
  });
});

describe("pause button", () => {
  it("shows only on a touch screen where the card opens (flight or Ada's room page), no card open", () => {
    expect(pauseButtonShown(true, true, false)).toBe(true);
    expect(pauseButtonShown(false, true, false)).toBe(false);
    expect(pauseButtonShown(true, false, false)).toBe(false);
    expect(pauseButtonShown(true, true, true)).toBe(false);
  });

  it("plays Chibi's two 60ms press frames once, swelling only in the first", () => {
    const frames = pauseFrames(json("sprites/ui-pause.json") as Parameters<typeof pauseFrames>[0]);
    expect(frames.rest).toHaveLength(1);
    expect(frames.press.map(({ duration }) => duration)).toEqual([60, 60]);
    expect(frames.held).toHaveLength(1);
    const manifest = json("manifest.json") as { sprites: { key: string; once: string[] }[] };
    expect(manifest.sprites.find(({ key }) => key === "ui-pause")?.once).toContain("press");
  });

  it("draws each sheet frame as its vector pose: 0 rest, 1 press, 2 and 3 held", () => {
    const frames = pauseFrames(json("sprites/ui-pause.json") as Parameters<typeof pauseFrames>[0]);
    const poses = [...frames.rest, ...frames.press, ...frames.held].map(({ index }) =>
      pausePose(index),
    );
    expect(poses).toEqual(["rest", "press", "held", "held"]);
    for (const path of Object.values(PAUSE_ART)) {
      expect(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8")).toContain(
        'viewBox="0 0 35 35"',
      );
    }
  });
});

describe("Escape and back", () => {
  it("pause where the card opens, open Settings only where its button shows, else do nothing", () => {
    expect(escapeTarget(true, false)).toBe("pause");
    expect(escapeTarget(false, true)).toBe("settings");
    expect(escapeTarget(false, false)).toBe("none");
  });

  it("open the Paused card in flight, and close Settings back to it", () => {
    const stack = createBackStack();
    const cards = { map: false, pause: false, settings: false };
    const layer = (key: keyof typeof cards, back: () => void) =>
      stack.register({ back, isOpen: () => cards[key] });
    layer("pause", () => {
      cards.pause = false;
    });
    layer("map", () => {
      cards.map = false;
      cards.pause = true;
    });
    layer("settings", () => {
      cards.settings = false;
      cards.pause = true;
    });
    const pause = vi.fn(() => {
      cards.pause = true;
    });
    expect(pressBack(stack, true, pause)).toBe("paused");
    cards.pause = false;
    cards.settings = true;
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards).toEqual({ map: false, pause: true, settings: false });
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards.pause).toBe(false);
    expect(pause).toHaveBeenCalledOnce();
  });
});
