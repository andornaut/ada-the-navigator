import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { createBackStack, pressBack } from "./back-stack.ts";
import {
  escapeTarget,
  PAUSE_BUTTON,
  pauseActions,
  pauseButtonPlacement,
  pauseButtonShown,
  pauseFrames,
  travelShowsEmpty,
} from "./pause.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/ui/${path}`, import.meta.url), "utf8"));

describe("Paused card", () => {
  it("stacks Resume (primary), Travel, Settings and Return home", () => {
    expect(pauseActions(false).map(({ id, role }) => [id, role])).toEqual([
      ["resume", "primary"],
      ["travel", "secondary"],
      ["settings", "secondary"],
      ["returnHome", "secondary"],
    ]);
    expect(pauseActions(false).every(({ available }) => available)).toBe(true);
  });

  it("keeps Travel and Return home visible but unavailable in danger", () => {
    const actions = pauseActions(true);
    expect(actions).toHaveLength(4);
    expect(actions.filter(({ available }) => !available).map(({ id }) => id)).toEqual([
      "travel",
      "returnHome",
    ]);
  });

  it("has Gameplay's strings, and no player-visible city name remains", () => {
    expect(PROTOTYPE.labels.pause).toBe("Pause");
    expect(PROTOTYPE.labels.pauseTitle).toBe("Paused");
    expect(PROTOTYPE.labels.returnHome).toBe("Return home");
    expect(PROTOTYPE.labels.travelUnavailable).toBe("Unavailable while you are in danger.");
    expect(PROTOTYPE.labels.toronto).toBeUndefined();
    expect(PROTOTYPE.labels.travelEmpty).toBe("No destinations mapped yet.");
    expect(JSON.stringify(PROTOTYPE)).not.toContain("Toronto");
  });
});

describe("Travel card", () => {
  it("says no destinations are mapped yet until one is discovered", () => {
    expect(travelShowsEmpty([])).toBe(true);
    expect(travelShowsEmpty([{ id: "workshop", label: "Workshop" }])).toBe(false);
  });
});

describe("pause button", () => {
  it("puts its disc edge 8px from the view's corner in a 52.5px press area", () => {
    const { frame, press } = pauseButtonPlacement();
    expect(frame + 1).toBe(8);
    expect(press + PAUSE_BUTTON.press / 2).toBe(frame + PAUSE_BUTTON.frame / 2);
  });

  it("shows only on a touch screen in flight with no card open", () => {
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
});

describe("Escape and back", () => {
  it("pause in flight, open Settings only where its button shows, and otherwise do nothing", () => {
    expect(escapeTarget(true, false)).toBe("pause");
    expect(escapeTarget(false, true)).toBe("settings");
    expect(escapeTarget(false, false)).toBe("none");
  });

  it("open the Paused card in flight, and close Settings back to it", () => {
    const stack = createBackStack();
    const cards = { pause: false, settings: false, travel: false };
    const layer = (key: keyof typeof cards, back: () => void) =>
      stack.register({ back, isOpen: () => cards[key] });
    layer("pause", () => {
      cards.pause = false;
    });
    layer("travel", () => {
      cards.travel = false;
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
    expect(cards).toEqual({ pause: true, settings: false, travel: false });
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards.pause).toBe(false);
    expect(pause).toHaveBeenCalledOnce();
  });
});
