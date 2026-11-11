import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS, GENERAL_NAMED, SPEAKERS } from "./conversations.ts";

// The player copy, with its line wrapping undone.
const COPY = readFileSync(new URL("../../gameplay/prototype-copy.md", import.meta.url), "utf8")
  .replace(/\s+/gu, " ")
  .trim();

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

  it("use the provisional timing and ranges", () => {
    expect(CONVERSATION_TUNING).toMatchObject({
      cooldownSeconds: 20,
      lineSeconds: 5,
      pennyRange: 900,
      quietSeconds: 60,
      shieldLowFraction: 0.25,
    });
  });
});
