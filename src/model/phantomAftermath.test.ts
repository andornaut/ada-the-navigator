import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { validPhantomProgress } from "./phantom.ts";
import { restoreSave } from "./save.ts";

function aftermath() {
  const model = new GameModel(CONTENT);
  model.state.selectedGalaxy = 6;
  const progress = model.state.progress[6];
  progress.questComplete = true;
  progress.holodisk = true;
  progress.phantom = {
    broken: [...PHANTOM_DESTINATIONS],
    flagshipKnown: true,
    freed: [...PHANTOM_DESTINATIONS],
  };
  model.state.unlocked = [1, 3, 4, 5, 2, 6];
  model.state.mode = "space";
  model.state.flight = createFlight(CONTENT, 6, 7, progress, model.state.economy);
  model.state.dialogue = {
    choices: [{ id: "continue", label: "Continue" }],
    context: "phantom.aftermath",
    text: "",
    title: "",
  };
  return model;
}

describe("Phantom aftermath completion", () => {
  it("records only the offered continuation and preserves existing station visit counts", () => {
    const model = aftermath();
    model.state.progress[6].greetings["station:0,0"] = 2;
    model.choose("unoffered");
    expect(model.state.progress[6].phantom?.aftermathComplete).toBeUndefined();
    model.choose("continue");
    expect(model.state.progress[6].phantom?.aftermathComplete).toBe(true);
    expect(model.state.dialogue).toBeNull();
    const restored = restoreSave(model.saveDocument());
    expect(restored?.progress[6].phantom?.aftermathComplete).toBe(true);
    expect(model.state.progress[6].greetings).toEqual({ "station:0,0": 2 });
    model.choose("continue");
    expect(model.state.progress[6].greetings).toEqual({ "station:0,0": 2 });
  });

  it("never infers aftermath completion from salvage or a different dialogue", () => {
    const model = aftermath();
    model.state.dialogue!.context = "holodiskHandover";
    expect(model.state.progress[6].phantom?.aftermathComplete).toBeUndefined();
    model.state.dialogue!.context = "salvage";
    model.choose("continue");
    expect(model.state.progress[6].phantom?.aftermathComplete).toBeUndefined();
  });

  it("rejects false, premature and inconsistent completion markers", () => {
    const model = aftermath();
    const progress = model.state.progress[6].phantom!;
    expect(validPhantomProgress({ ...progress, aftermathComplete: false })).toBe(false);
    expect(
      validPhantomProgress({ ...progress, aftermathComplete: true, flagshipKnown: false }),
    ).toBe(false);
    expect(validPhantomProgress({ ...progress, aftermathComplete: true, freed: [] })).toBe(false);
    const document = new GameModel(CONTENT).saveDocument();
    document.progress[6].phantom = { ...progress, aftermathComplete: true };
    expect(restoreSave(document)).toBeNull();
  });
});
