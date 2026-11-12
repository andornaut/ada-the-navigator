import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { controlHelpText } from "../ui/control-help.ts";
import { SHIELD_PILL } from "../ui/layout/playView.ts";
import { CONTROL_WORDS } from "./control-words.ts";
import {
  BOX_PRIORITIES,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  CONVERSATIONS,
  GENERAL_NAMED,
  SPEAKERS,
} from "./conversations.ts";
import { JOB_LORE } from "./jobs.ts";

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
    text.matchAll(
      /(Astra|Ada|Penny|Unknown voice|General Gadget): "([^"]+)"(?: \((happy|neutral|upset)\))?/gu,
    ),
    ([, name = "", line = "", mood]) => (mood ? { mood, name, text: line } : { name, text: line }),
  );
}

// Black Eye's pool waits for a Black Eye flight: no galaxy past Whirlpool can be flown yet.
// Needle's and Andromeda's pools wait for their chapters.
const IN_FLIGHT = passage("## In-flight conversations", " Needle: - First arrival");
const BLACK_EYE = passage("Black Eye: - First arrival");
const BROADCASTS = passage("Memory lines and broadcasts follow", "Outposts handing over");

type Conversation = (typeof CONVERSATIONS)[number];

// A speaker's tab as the documents name it: the General's broadcasts from the third holodisk on
// play under his name.
const nameOf = ({ trigger }: Conversation, speaker: keyof typeof SPEAKERS) =>
  speaker === "general" && trigger.kind === "general" && trigger.held >= GENERAL_NAMED.holodisks
    ? GENERAL_NAMED.name
    : SPEAKERS[speaker].name;

// A line as the documents write it: each control token as the control's name.
const written = (text: string) => controlHelpText(CONTROL_WORDS, text);

// Conversations' lines as the documents name their speakers, with any mood.
const spoken = (conversations: readonly Conversation[]) =>
  conversations.flatMap((conversation) =>
    conversation.lines.map(({ mood, speaker, text: line }) => {
      const name = nameOf(conversation, speaker);
      const text = written(line);
      return mood ? { mood, name, text } : { name, text };
    }),
  );
// Job lines are the quests document's; every other line is the player copy's.
const isJob = ({ trigger }: Conversation) => trigger.kind === "job" || trigger.kind === "jobLore";
const DATA_LINES = spoken(CONVERSATIONS.filter((conversation) => !isJob(conversation)));

describe("in-flight conversations", () => {
  it("speak every line as the player copy has it, with its speaker", () => {
    for (const conversation of CONVERSATIONS) {
      const { lines, trigger } = conversation;
      for (const { desktop, speaker, text: line } of lines) {
        const text = written(line);
        if (trigger.kind === "jobLore") {
          // The quests document lists Astra's job lore lines by galaxy.
          expect(speaker).toBe("astra");
          expect(QUESTS).toContain(`"${text}"`);
          continue;
        }
        const source = trigger.kind === "job" ? QUESTS : COPY;
        expect(source).toContain(`${nameOf(conversation, speaker)}: "${text}"`);
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

  it("leave out Black Eye's pool, which has no flight to play in, apart from its job lore", () => {
    const pool = spokenLines(BLACK_EYE);
    expect(pool).toHaveLength(6);
    // Black Eye's stations give jobs, so Astra's two job lore lines play there.
    const lore = new Set(JOB_LORE[6]);
    expect(lore.size).toBe(2);
    for (const line of pool.filter(({ text }) => !lore.has(text))) {
      expect(DATA_LINES).not.toContainEqual(line);
    }
    // Only job lore plays past the built galaxies, where every galaxy's stations give jobs.
    expect(
      CONVERSATIONS.filter(({ trigger }) => "sector" in trigger && trigger.sector > 3).every(
        ({ trigger }) => trigger.kind === "jobLore",
      ),
    ).toBe(true);
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
    // Every mood the copy marks, and only those: its other lines show neutral.
    const copied = [...spokenLines(IN_FLIGHT), ...spokenLines(BROADCASTS)];
    for (const mood of ["happy", "upset"] as const) {
      const marked = (lines: readonly { mood?: string; name: string; text: string }[]) =>
        lines
          .filter((spoken) => spoken.mood === mood)
          .map(({ name, text }) => `${name}: ${text}`)
          .sort();
      expect(marked(DATA_LINES), mood).toEqual(marked(copied));
    }
    expect(DATA_LINES).toContainEqual({ mood: "happy", name: "Ada", text: "Like a magnet!" });
    expect(DATA_LINES).toContainEqual({ mood: "upset", name: "Penny", text: "Grr..." });
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
    ).toEqual(Array(4).fill("warning"));
  });

  it("warn of a low shield at the same share that turns the shield pill low", () => {
    expect(CONVERSATION_TUNING.shieldLowFraction).toBe(SHIELD_PILL.low);
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
