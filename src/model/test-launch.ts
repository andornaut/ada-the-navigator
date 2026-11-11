import type { GameModel } from "./game.ts";

/**
 * Test support: answers a chapter opening with `choice`, then continues through the prologue
 * or boarding line until the flight starts.
 */
export function playOpening(model: GameModel, choice = "0"): void {
  model.choose(choice);
  for (let panel = 0; panel < 20 && model.state.mode === "home"; panel++) {
    const dialogue = model.state.dialogue;
    if (!dialogue || !/^(prologue|boarding)/.test(dialogue.context)) {
      return;
    }
    model.choose("continue");
  }
}
