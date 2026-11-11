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

// Gameplay's player copy and contract, with their line wrapping undone.
const read = (name: string) =>
  readFileSync(new URL(`../../gameplay/${name}`, import.meta.url), "utf8")
    .replace(/\s+/gu, " ")
    .trim();
const COPY = read("prototype-copy.md");
const CONTRACT = read("prototype.md");

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
      for (const { speaker, text } of pages) {
        const source = text === PROTOTYPE.premise.roomRock ? CONTRACT : COPY;
        expect(source).toContain(`"${text}"`);
        if (speaker) {
          expect(COPY).toContain(`${speaker}: "${text}"`);
        }
      }
    }
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
      `Home with nothing new: Narration: "${PROTOTYPE.premise.emptyHome}" then ${labels.pickUpRock}`,
    );
  });
});
