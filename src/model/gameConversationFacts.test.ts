import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ConversationDirector } from "./conversations.ts";
import { GameModel } from "./game.ts";

afterEach(() => vi.restoreAllMocks());

describe("Game conversation eligibility facts", () => {
  it("reads live flight identity and progress through title, Continue and restart", () => {
    const attachment = vi.spyOn(ConversationDirector.prototype, "setEligibilityReader");
    const model = new GameModel(CONTENT);
    expect(attachment).toHaveBeenCalledTimes(1);
    const read = attachment.mock.calls[0]![0];
    expect(read()).toEqual({ galaxy: null, holodisks: 0, questComplete: false, resolved: false });
    model.state.unlocked.push(4);
    model.startGalaxy(4);
    expect(read()).toEqual({ galaxy: 4, holodisks: 0, questComplete: false, resolved: false });
    model.state.progress[1].holodisk = true;
    model.state.progress[4].questComplete = true;
    expect(read()).toEqual({ galaxy: 4, holodisks: 1, questComplete: true, resolved: false });
    model.state.progress[4].resolved = true;
    expect(read().resolved).toBe(true);
    model.backToTitle();
    expect(read()).toEqual({ galaxy: null, holodisks: 1, questComplete: false, resolved: false });
    model.continueGame();
    expect(read()).toEqual({ galaxy: 4, holodisks: 1, questComplete: true, resolved: true });
    model.backToTitle();
    model.restart();
    expect(read()).toEqual({ galaxy: null, holodisks: 0, questComplete: false, resolved: false });
  });

  it("never exposes a lower-priority line hidden by a notice or the title screen", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    model.step(0.001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    const exposure = vi.spyOn(ConversationDirector.prototype, "showing", "get");
    model.state.notice = "Notice";
    const seen = [...model.state.seenConversations];
    expect(model.conversation).toBeNull();
    expect(exposure).not.toHaveBeenCalled();
    expect(model.state.seenConversations).toEqual(seen);
    model.dismissNotice();
    model.state.dialogue = { choices: [], context: "panel", text: "", title: "" };
    expect(model.conversation).toBeNull();
    expect(exposure).not.toHaveBeenCalled();
    model.state.dialogue = null;
    model.state.docked = "station:0,0";
    expect(model.conversation).toBeNull();
    expect(exposure).not.toHaveBeenCalled();
    model.state.docked = null;
    expect(model.conversation).not.toBeNull();
    expect(exposure).toHaveBeenCalledTimes(1);
    model.backToTitle();
    exposure.mockClear();
    expect(model.conversation).toBeNull();
    expect(exposure).not.toHaveBeenCalled();
  });
});
