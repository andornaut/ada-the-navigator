import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { boardingScene, openingScene, roomBackground, roomScene } from "./storybook.ts";

const labels = { continue: "Continue", pickUpRock: "Pick up rock" };

describe("Phantom party room context", () => {
  it("carries the actual Phantom opening into its room and boarding narration", () => {
    const opening = openingScene(CONTENT, 6);
    const background = roomBackground(opening.pages);
    expect(background).toBe("adaRoomParty");
    const room = roomScene(CONTENT, labels, false, background);
    expect(room.pages[0]?.background).toBe("adaRoomParty");
    for (const announce of [false, true]) {
      const boarding = boardingScene(
        CONTENT,
        announce,
        roomBackground([...opening.pages, ...room.pages]),
      );
      for (const page of boarding.pages) {
        expect(page.background).toBe(page.speaker ? "aboard" : "adaRoomParty");
      }
      expect(boarding.pages[0]?.text).toBe(CONTENT.premise.boarding[0]?.text);
    }
  });

  it("keeps empty visits and ordinary boarding in the ordinary room", () => {
    expect(roomBackground([])).toBe("adaRoom");
    expect(roomScene(CONTENT, labels, true).pages[0]?.background).toBe("adaRoom");
    expect(boardingScene(CONTENT, false).pages[0]?.background).toBe("adaRoom");
    for (const galaxy of [1, 2, 3, 4, 5] as const) {
      expect(
        openingScene(CONTENT, galaxy).pages.some((page) => page.background === "adaRoomParty"),
      ).toBe(false);
    }
  });

  it("lets later explicit morning and night scenes replace party context", () => {
    const party = openingScene(CONTENT, 6).pages;
    for (const [background, expected] of [
      ["adaRoomMorning", "adaRoomMorningCats"],
      ["adaRoomSleep", "adaRoomNight"],
      ["adaRoomNightGlowing", "adaRoomNight"],
    ] as const) {
      expect(roomBackground([...party, { background, id: "later", text: "" }])).toBe(expected);
    }
    expect(roomBackground([{ background: "adaRoomNight", id: "night", text: "" }, ...party])).toBe(
      "adaRoomParty",
    );
  });
});
