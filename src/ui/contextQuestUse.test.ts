import { describe, expect, it, vi } from "vitest";

import { ControlState } from "../input/state.ts";
import type { ContextQuestDetails } from "../model/questObjectLinks.ts";
import { consumeContextQuestUse } from "./contextQuestUse.ts";
import { TOUCH_CHROME_COLOURS, useDiscLayers } from "./touchChrome.ts";

const context: ContextQuestDetails = {
  quests: [
    {
      galaxy: 1,
      id: "story:1:1",
      line: { kind: "story", target: null, text: "Known objective" },
      locations: [],
    },
  ],
  targetId: "known",
};
const sample = { aim: { x: 1, y: 0 }, fire: true, move: { x: 0, y: 1 }, use: true };

describe("contextual Use activation", () => {
  it("reads the current canonical getter, not the previous presentation", () => {
    let current: ContextQuestDetails | null = context;
    const read = vi.fn(() => current);
    const open = vi.fn(() => true);
    // A real interaction, including repeatable Dock, makes the model getter null.
    current = null;
    expect(consumeContextQuestUse(read, open, sample)).toBe(sample);
    expect(open).not.toHaveBeenCalled();
    current = context;
    expect(consumeContextQuestUse(read, open, sample)).toEqual({
      aim: { x: 0, y: 0 },
      move: { x: 0, y: 0 },
      use: false,
    });
    expect(open).toHaveBeenCalledExactlyOnceWith(context);
    current = null;
    expect(consumeContextQuestUse(read, open, sample)).toBe(sample);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("preserves real Use when a route refuses to open", () => {
    expect(
      consumeContextQuestUse(
        () => context,
        () => false,
        sample,
      ),
    ).toBe(sample);
  });

  it("does not query or open on release, modal, disabled or cancelled input", () => {
    const read = vi.fn(() => context),
      open = vi.fn(() => true);
    const state = new ControlState();
    state.setUseAvailable(true);
    state.requestUse();
    state.reset();
    consumeContextQuestUse(read, open, state.sample());
    state.setEnabled(false);
    state.requestUse();
    consumeContextQuestUse(read, open, state.sample());
    state.setEnabled(true);
    state.openModal();
    state.requestUse();
    consumeContextQuestUse(read, open, state.sample());
    expect(read).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("consumes a keyboard press once without replay on release", () => {
    const read = vi.fn(() => context),
      open = vi.fn(() => true);
    const state = new ControlState();
    state.setUseAvailable(true);
    state.keyDown("Space");
    consumeContextQuestUse(read, open, state.sample());
    state.keyDown("Space", true);
    consumeContextQuestUse(read, open, state.sample());
    state.keyUp("Space");
    consumeContextQuestUse(read, open, state.sample());
    expect(open).toHaveBeenCalledExactlyOnceWith(context);
  });

  it("draws only the existing ring under the canonical quest icon in every pose", () => {
    for (const pose of ["rest", "press", "held"] as const) {
      const ring = useDiscLayers(TOUCH_CHROME_COLOURS, "quest", pose);
      expect(ring).toEqual(useDiscLayers(TOUCH_CHROME_COLOURS, "use", pose).slice(0, 2));
      expect(ring).toHaveLength(2);
    }
  });
});
