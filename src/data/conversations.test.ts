import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STATUS_PILL } from "../ui/layout/playView.ts";
import {
  BOX_PRIORITIES,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  CONVERSATIONS,
  GENERAL_NAMED,
  SPEAKERS,
} from "./conversations.ts";

// Gameplay's documents, with their line wrapping undone.
const read = (name: string) =>
  readFileSync(new URL(`../../gameplay/${name}`, import.meta.url), "utf8")
    .replace(/\s+/gu, " ")
    .trim();
// The player copy, and the job lines in the quests document.
const COPY = read("player-copy.md");
const QUESTS = read("quests.md");

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

// Black Eye's pool waits for a Black Eye flight: no galaxy past Whirlpool can be flown yet.
const IN_FLIGHT = passage("## In-flight conversations", " Black Eye: - First arrival");
const BLACK_EYE = passage("Black Eye: - First arrival");
const BROADCASTS = passage("General's broadcasts", "Outposts handing over");

// Conversations' lines as the documents name their speakers, with any mood.
const spoken = (conversations: typeof CONVERSATIONS) =>
  conversations.flatMap(({ lines }) =>
    lines.map(({ mood, speaker, text }) =>
      mood ? { mood, name: SPEAKERS[speaker].name, text } : { name: SPEAKERS[speaker].name, text },
    ),
  );
// Job lines are the quests document's; every other line is the player copy's.
const isJob = ({ trigger }: (typeof CONVERSATIONS)[number]) =>
  trigger.kind === "job" || trigger.kind === "jobLore";
const DATA_LINES = spoken(CONVERSATIONS.filter((conversation) => !isJob(conversation)));

describe("in-flight conversations", () => {
  it("speak every line as the player copy has it, with its speaker", () => {
    for (const { lines, trigger } of CONVERSATIONS) {
      for (const { desktop, speaker, text } of lines) {
        if (trigger.kind === "jobLore") {
          // The quests document lists Astra's job lore lines by galaxy.
          expect(speaker).toBe("astra");
          expect(QUESTS).toContain(`"${text}"`);
          continue;
        }
        const source = trigger.kind === "job" ? QUESTS : COPY;
        expect(source).toContain(`${SPEAKERS[speaker].name}: "${text}"`);
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

  it("speak the quests document's in-flight job lines with their moods", () => {
    const start = QUESTS.indexOf("In-flight lines");
    const copied = spokenLines(QUESTS.slice(start, QUESTS.indexOf(" ## ", start)));
    const jobs = spoken(CONVERSATIONS.filter(({ trigger }) => trigger.kind === "job"));
    expect(jobs).toEqual(copied);
    expect(jobs).toContainEqual({ mood: "happy", name: "Ada", text: "Hold on, we've got you!" });
  });

  it("leave out Black Eye's pool, which has no flight to play in", () => {
    const pool = spokenLines(BLACK_EYE);
    expect(pool).toHaveLength(6);
    for (const line of pool) {
      expect(DATA_LINES).not.toContainEqual(line);
    }
    expect(CONVERSATIONS.some(({ trigger }) => "sector" in trigger && trigger.sector > 3)).toBe(
      false,
    );
  });

  it("grow Astra with an arrival and two quiet stretches in each of Cartwheel and Whirlpool", () => {
    for (const sector of [2, 3]) {
      expect(
        CONVERSATIONS.filter(
          ({ priority, trigger }) =>
            priority === "lore" &&
            (trigger.kind === "arrival" || trigger.kind === "quiet") &&
            trigger.sector === sector,
        ).map(({ id }) => id.split(":")[0]),
      ).toEqual(["arrival", "quiet", "quiet"]);
    }
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
      ["Ada", "Noisy is good. Busy means people."],
      ["Ada", "That's what exploring is for."],
      ["Ada", "You sound more like yourself."],
      ["Ada", "Our maps."],
      ["Ada", "Me too."],
    ]);
    expect(DATA_LINES.filter(({ mood }) => mood === "upset")).toEqual([
      { mood: "upset", name: "Penny", text: "Whimper..." },
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
      ["grower", "right"],
      ["miner", "right"],
      ["penny", "right"],
      ["salvager", "right"],
      ["station", "right"],
      ["whaleFamily", "right"],
      ["workshop", "right"],
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

  it("warn of a low shield at the same share that turns the status pill low", () => {
    expect(CONVERSATION_TUNING.shieldLowFraction).toBe(STATUS_PILL.low);
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
