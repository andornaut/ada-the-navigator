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
          expect(COPY).toContain(`${speaker}: "${text}"`);
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
          expect(COPY).toContain(`${speaker}: "${text}"`);
        }
      }
    }
    const narration = scenes.flatMap(({ pages }) => pages).filter(({ speaker }) => !speaker);
    expect(narration.map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        PROTOTYPE.chapters[1].opening,
        PROTOTYPE.premise.roomRock,
        PROTOTYPE.premise.emptyHome,
        "Ada holds Penny close and touches the rock's glow.",
      ]),
    );
  });

  it("splits the prologue's opening as the copy's page breaks", () => {
    const [park, polish, glow] = PROTOTYPE.premise.prologue;
    expect(COPY).toContain(`Park page: "${park?.text}"`);
    expect(COPY).toContain(`Ada's room, rock unpolished: "${polish?.text}"`);
    expect(COPY).toContain(`Ada's room, rock glowing: "${glow?.text}" Choice: "${glow?.choice}"`);
    expect([park, polish, glow].map((step) => step?.background)).toEqual([
      "park",
      "adaRoomUnpolished",
      "adaRoom",
    ]);
  });

  it("follows each chapter choice with its own branch page", () => {
    for (const galaxy of galaxies) {
      const chapter = PROTOTYPE.chapters[galaxy];
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
          expect(COPY).toContain(`Choice: "${action}"`);
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
});
