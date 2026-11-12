import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import {
  boardingScene,
  openingScene,
  prologueScene,
  resolutionScene,
  roomScene,
  type Scene,
} from "./storybook.ts";

// A dialogue line as the copy has it: its speaker, perhaps with where it shows ("Mom, after the
// branch page:"), then the line in quotes.
const literal = (text: string) => text.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&");
const spoken = (speaker: string, text: string) =>
  new RegExp(`${literal(speaker)}(?:, [^:"]+)?: "${literal(text)}"`, "u");

// Gameplay's player copy and rules, with their line wrapping undone.
const read = (name: string) =>
  readFileSync(new URL(`../../gameplay/${name}`, import.meta.url), "utf8")
    .replace(/\s+/gu, " ")
    .trim();
const COPY = read("player-copy.md");
const CONTRACT = read("rules.md");

const labels = {
  continue: PROTOTYPE.labels.continue ?? "",
  pickUpRock: PROTOTYPE.labels.pickUpRock ?? "",
};
const galaxies = [1, 2, 3] as const;
const scenes: readonly Scene[] = [
  ...galaxies.flatMap((galaxy) => [
    openingScene(PROTOTYPE, galaxy),
    resolutionScene(PROTOTYPE, galaxy),
  ]),
  // The first launch frames chapter one's opening with Grandma's garden.
  openingScene(PROTOTYPE, 1, true),
  prologueScene(PROTOTYPE, labels),
  roomScene(PROTOTYPE, labels, false),
  roomScene(PROTOTYPE, labels, true),
  boardingScene(PROTOTYPE, false),
  boardingScene(PROTOTYPE, true),
];

describe("storybook text", () => {
  it("shows every page as the player copy has it, with its speaker or as narration", () => {
    for (const { pages } of scenes) {
      for (const { speaker, text } of pages.filter(({ text }) => text !== "")) {
        const source = text === PROTOTYPE.premise.roomRock ? CONTRACT : COPY;
        expect(source).toContain(`"${text}"`);
        if (speaker) {
          expect(COPY).toMatch(spoken(speaker, text));
        }
      }
    }
  });

  it("shows narration without a name tab", () => {
    for (const { pages } of scenes) {
      for (const { speaker, text } of pages) {
        if (COPY.includes(`Narration: "${text}"`) || speaker === undefined) {
          expect(speaker).toBeUndefined();
        } else {
          expect(COPY).toMatch(spoken(speaker, text));
        }
      }
    }
    const narration = scenes.flatMap(({ pages }) => pages).filter(({ speaker }) => !speaker);
    expect(narration.map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        PROTOTYPE.chapters[1]!.opening,
        PROTOTYPE.premise.roomRock,
        PROTOTYPE.premise.emptyHome,
        "Ada holds Penny close and touches the rock's glow.",
      ]),
    );
  });

  it("pages the opening as the copy's sections, each at its location", () => {
    const { gardenArrival, gardenFarewell, prologue } = PROTOTYPE.premise;
    // Each section of the copy, as its heading and its lines in order, with the pages that show it.
    const line = ({ speaker, text }: { speaker?: string; text: string }) =>
      `- ${speaker ?? "Narration"}: "${text}"`;
    const section = (heading: string, steps: readonly { speaker?: string; text: string }[]) =>
      `${heading} ${steps.map(line).join(" ")}`;
    const park = prologue.slice(0, 3);
    // Ada polishes the rock, and Archie and Kiwi watch from the bed.
    const polish = prologue.slice(3, 5);
    const glow = prologue[5]!;
    const standing = prologue.filter((step) => !step.background);
    const seated = prologue.filter((step) => step.background === "cockpitSeated");
    expect(COPY).toContain(
      section(
        "First launch only, before chapter one's opening, in Grandma's garden:",
        gardenArrival,
      ),
    );
    expect(COPY).toContain(`garden: ${line(gardenFarewell)}`);
    expect(COPY).toContain(section("In the park:", park));
    expect(COPY).toContain(section("Ada's room, rock unpolished:", polish));
    expect(COPY).toContain(`Ada's room, rock glowing: ${line(glow)} Action: "${glow.choice}"`);
    expect(COPY).toContain(section("Aboard, standing:", standing));
    expect(COPY).toContain(section("Aboard, seated:", seated.slice(0, 2)));
    expect(COPY).toContain(`${line(seated[2]!)} Action: "${seated[2]!.choice}"`);
    expect([...gardenArrival, gardenFarewell].map((step) => step.background)).toEqual(
      Array<string>(5).fill("grandmaGarden"),
    );
    expect([...park, ...polish, glow].map((step) => step.background)).toEqual([
      "park",
      "park",
      "park",
      "adaRoomUnpolished",
      "adaRoomUnpolishedCats",
      "adaRoom",
    ]);
    expect(standing).toHaveLength(14);
    expect(seated).toHaveLength(3);
  });

  it("follows each chapter choice with its own branch page", () => {
    for (const galaxy of galaxies) {
      const chapter = PROTOTYPE.chapters[galaxy]!;
      const pairs = [
        [chapter.openingChoices, chapter.openingBranches],
        [chapter.resolutionChoices, chapter.resolutionBranches],
      ] as const;
      for (const [choices, branches] of pairs) {
        choices.forEach((choice, index) => {
          expect(COPY).toContain(`- "${choice}": "${branches[index]}"`);
        });
      }
      expect(COPY).toContain(`Opening: "${chapter.opening}"`);
      expect(COPY).toContain(`Home resolution: "${chapter.resolution}"`);
      expect(COPY).toContain(`Closing: "${chapter.closing}"`);
    }
  });

  it("offers each choice, question and named action as the player copy has it", () => {
    for (const { pages } of scenes) {
      for (const { action, choices, questions } of pages) {
        for (const { label } of [...(choices ?? []), ...(questions ?? [])]) {
          expect(COPY).toContain(`"${label}"`);
        }
        if (action && action !== labels.continue && action !== labels.pickUpRock) {
          expect(COPY).toContain(`Action: "${action}"`);
        }
      }
    }
    for (const { answer, question } of PROTOTYPE.premise.prologue.flatMap(
      (step) => step.questions ?? [],
    )) {
      expect(COPY).toContain(`- "${question}" Astra: "${answer}"`);
    }
    expect(COPY).toContain(
      `Storybook pages: Previous, Next, Skip. Boarding from Ada's room: ${labels.pickUpRock}`,
    );
    expect(COPY).toContain(
      `Earth with nothing new: Narration: "${PROTOTYPE.premise.emptyHome}" then ${labels.pickUpRock}`,
    );
  });
  it("keeps every page within Gameplay's limits: 220 characters and three choices", () => {
    expect(COPY).toContain(
      "A story page's text is at most 220 characters and a page offers at most three choices. " +
        "On a page with three choices every label fits one line, at most 23 characters; labels " +
        "up to 36 characters, which wrap to two lines, appear only on pages with two choices or " +
        "fewer.",
    );
    for (const { pages } of scenes) {
      for (const { choices, questions, text } of pages) {
        const offered = choices ?? questions ?? [];
        expect(text.length, text).toBeLessThanOrEqual(220);
        expect(offered.length, text).toBeLessThanOrEqual(3);
        // Three choices keep one line each; two or fewer may wrap to two.
        const longest = offered.length === 3 ? 23 : 36;
        for (const { label } of offered) {
          expect(label.length, label).toBeLessThanOrEqual(longest);
        }
      }
    }
  });

  it("heads the opening, resolution and closing pages with the chapter's panel title", () => {
    for (const galaxy of galaxies) {
      const chapter = PROTOTYPE.chapters[galaxy]!;
      expect(COPY).toContain(`Panel title: ${chapter.name}.`);
      const headed = [openingScene(PROTOTYPE, galaxy), resolutionScene(PROTOTYPE, galaxy)]
        .flatMap(({ pages }) => pages)
        .filter(({ heading }) => heading !== undefined);
      expect(headed.map(({ id }) => id)).toEqual(["opening", "resolution", "closing"]);
      expect(new Set(headed.map(({ heading }) => heading))).toEqual(new Set([chapter.name]));
    }
    // Every other page shows no heading.
    for (const scene of [prologueScene(PROTOTYPE, labels), roomScene(PROTOTYPE, labels, true)]) {
      expect(scene.pages.filter(({ heading }) => heading !== undefined)).toEqual([]);
    }
  });
});
