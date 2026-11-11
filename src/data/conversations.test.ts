import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BOX_PRIORITIES,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  CONVERSATIONS,
  GENERAL_NAMED,
  SPEAKERS,
} from "./conversations.ts";

// The player copy, with its line wrapping undone.
const COPY = readFileSync(new URL("../../gameplay/player-copy.md", import.meta.url), "utf8")
  .replace(/\s+/gu, " ")
  .trim();

// A copy passage from its heading or lead-in up to until, by default the next heading.
function passage(start: string, until = " ## "): string {
  const from = COPY.indexOf(start);
  const end = COPY.indexOf(until, from + start.length);
  if (from < 0 || end < 0) {
    throw new Error(`No copy passage from "${start}" to "${until}"`);
  }
  return COPY.slice(from, end);
}

// Every speaker line in passage, with the mood marker that may follow it; a desktop wording
// follows its line as (desktop: "...") and has no speaker of its own.
function spokenLines(text: string): { mood?: string; name: string; text: string }[] {
  return Array.from(
    text.matchAll(/(Astra|Ada|Penny|Unknown voice): "([^"]+)"(?: \((happy|neutral|upset)\))?/gu),
    ([, name = "", line = "", mood]) => (mood ? { mood, name, text: line } : { name, text: line }),
  );
}

const IN_FLIGHT = passage("## In-flight conversations");
const BROADCASTS = passage("General's broadcasts", "Outposts handing over");

// The data's lines as the copy names their speakers, with any mood.
const DATA_LINES = CONVERSATIONS.flatMap(({ lines }) =>
  lines.map(({ mood, speaker, text }) =>
    mood ? { mood, name: SPEAKERS[speaker].name, text } : { name: SPEAKERS[speaker].name, text },
  ),
);

describe("in-flight conversations", () => {
  it("speak every line as the player copy has it, with its speaker", () => {
    for (const { lines } of CONVERSATIONS) {
      for (const { desktop, speaker, text } of lines) {
        expect(COPY).toContain(`${SPEAKERS[speaker].name}: "${text}"`);
        if (desktop !== undefined) {
          expect(COPY).toContain(`${text}" (desktop: "${desktop}")`);
        }
      }
    }
    expect(COPY).toContain(`then "${GENERAL_NAMED.name}"`);
  });

  it("speak every line of the copy's in-flight section and the General's broadcasts", () => {
    const copied = [...spokenLines(IN_FLIGHT), ...spokenLines(BROADCASTS)];
    expect(copied.length).toBeGreaterThan(30);
    expect(DATA_LINES).toEqual(expect.arrayContaining(copied));
    expect(copied).toEqual(expect.arrayContaining(DATA_LINES));
    expect(copied).toHaveLength(DATA_LINES.length);
  });

  it("give Ada's and Penny's lines the copy's moods, neutral when unmarked", () => {
    const happy = DATA_LINES.filter(({ mood }) => mood === "happy").map(({ name, text }) => [
      name,
      text,
    ]);
    expect(happy).toEqual([
      ["Ada", "Like a magnet!"],
      ["Ada", "Shopping in space!"],
      ["Penny", "Woof! Woof!"],
      ["Ada", "Penny, did you sense something, girl?"],
      ["Ada", "Our map is growing!"],
      ["Ada", "Then let's make new memories."],
      ["Ada", "Maybe they can fix you too, Astra!"],
      ["Ada", "She thinks you're fun."],
    ]);
    for (const { lines } of CONVERSATIONS) {
      for (const { mood, speaker } of lines) {
        if (mood !== undefined) {
          expect(["ada", "penny"]).toContain(speaker);
        }
      }
    }
  });

  it("have one to three lines and distinct ids", () => {
    const ids = CONVERSATIONS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { lines } of CONVERSATIONS) {
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(3);
    }
  });

  it("seat Ada on the left and every other speaker on the right", () => {
    expect(Object.entries(SPEAKERS).map(([speaker, { side }]) => [speaker, side])).toEqual([
      ["ada", "left"],
      ["astra", "right"],
      ["general", "right"],
      ["penny", "right"],
    ]);
  });

  it("rank warnings, notices, lessons, Penny, then lore", () => {
    expect(BOX_PRIORITIES).toEqual(["warning", "notice", "lesson", "penny", "lore"]);
    expect(CONVERSATION_PRIORITIES).toEqual(
      BOX_PRIORITIES.filter((priority) => priority !== "notice"),
    );
    expect(
      CONVERSATIONS.filter(({ id }) => id.startsWith("general:")).map((c) => c.priority),
    ).toEqual(["warning", "warning"]);
  });

  it("use the provisional timing and ranges", () => {
    expect(CONVERSATION_TUNING).toMatchObject({
      cooldownSeconds: 20,
      lineSeconds: 5,
      pennyIntervalSeconds: 60,
      pennyRange: 900,
      quietSeconds: 60,
      shieldLowFraction: 0.25,
    });
  });
});
