import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { boardingScene, openingScene, roomBackground, roomScene } from "./storybook.ts";

const labels = { continue: "Continue", pickUpRock: "Pick up rock" };

describe("Needle recorder room context", () => {
  it("keeps the recorder from the actual opening through room and boarding narration", () => {
    const opening = openingScene(CONTENT, 4);
    const background = roomBackground(opening.pages);
    expect(background).toBe("adaRoomRecorder");
    const room = roomScene(CONTENT, labels, false, background);
    expect(room.pages[0]?.background).toBe("adaRoomRecorder");
    for (const announce of [false, true]) {
      const boarding = boardingScene(
        CONTENT,
        announce,
        roomBackground([...opening.pages, ...room.pages]),
      );
      for (const page of boarding.pages) {
        expect(page.background).toBe(page.speaker ? "aboard" : "adaRoomRecorder");
      }
      expect(boarding.pages[0]?.text).toBe(CONTENT.premise.boarding[0]?.text);
    }
  });

  it("does not infer a recorder or Dad portrait for an ordinary visit", () => {
    expect(roomBackground([])).toBe("adaRoom");
    expect(roomBackground([{ background: "adaRoomRecorderDad", id: "dad", text: "" }])).toBe(
      "adaRoom",
    );
  });

  it("uses the latest explicit recorder, invitation or lighting variant", () => {
    const recorder = openingScene(CONTENT, 4).pages;
    const invitation = openingScene(CONTENT, 6).pages;
    expect(roomBackground([...recorder, ...invitation])).toBe("adaRoomInvitations");
    expect(roomBackground([...invitation, ...recorder])).toBe("adaRoomRecorder");
    expect(
      roomBackground([...recorder, { background: "adaRoomNight", id: "night", text: "" }]),
    ).toBe("adaRoomNight");
  });
});
