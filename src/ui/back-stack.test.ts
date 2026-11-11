import { describe, expect, it, vi } from "vitest";

import { type BackLayer, createBackStack, pressBack } from "./back-stack.ts";

// A card that back closes.
function card(open = false) {
  const layer = {
    back: vi.fn(() => {
      layer.open = false;
    }),
    isOpen: () => layer.open,
    open,
  };
  return layer satisfies BackLayer;
}

// The game's cards in their stacking order, outermost first.
function game() {
  const stack = createBackStack();
  const cards = {
    cheats: card(),
    settings: card(),
    steps: card(),
    update: card(),
  };
  for (const layer of Object.values(cards)) {
    stack.register(layer);
  }
  return { cards, stack };
}

describe("back", () => {
  it("closes the install steps before Settings, then Settings", () => {
    const { cards, stack } = game();
    cards.settings.open = true;
    cards.steps.open = true;
    const pause = vi.fn();
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards.steps.back).toHaveBeenCalledOnce();
    expect(cards.settings.open).toBe(true);
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards.settings.open).toBe(false);
    expect(pause).not.toHaveBeenCalled();
  });

  it("closes the cheats card", () => {
    const { cards, stack } = game();
    cards.cheats.open = true;
    expect(pressBack(stack, true, vi.fn())).toBe("closed");
    expect(cards.cheats.back).toHaveBeenCalledOnce();
  });

  it("defers the update offer", () => {
    const { cards, stack } = game();
    cards.update.open = true;
    expect(pressBack(stack, false, vi.fn())).toBe("closed");
    expect(cards.update.back).toHaveBeenCalledOnce();
  });

  it("pauses flight with nothing open, and resumes once Settings shows", () => {
    const { cards, stack } = game();
    const pause = vi.fn(() => {
      cards.settings.open = true;
    });
    expect(pressBack(stack, true, pause)).toBe("paused");
    expect(pressBack(stack, true, pause)).toBe("closed");
    expect(cards.settings.open).toBe(false);
    expect(pause).toHaveBeenCalledOnce();
  });

  it("does nothing outside flight with nothing open", () => {
    const { stack } = game();
    const pause = vi.fn();
    expect(pressBack(stack, false, pause)).toBe("none");
    expect(pause).not.toHaveBeenCalled();
  });

  it("lets a later card join as the innermost and leave again", () => {
    const { cards, stack } = game();
    const station = card(true);
    cards.settings.open = true;
    const leave = stack.register(station);
    expect(stack.back()).toBe(true);
    expect(station.back).toHaveBeenCalledOnce();
    station.open = true;
    leave();
    stack.back();
    expect(station.back).toHaveBeenCalledOnce();
    expect(cards.settings.open).toBe(false);
  });
});
