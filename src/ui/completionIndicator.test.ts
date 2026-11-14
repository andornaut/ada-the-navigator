import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMPLETION_INDICATOR,
  COMPLETION_INDICATOR_STYLE,
  createCompletionIndicator,
} from "./completionIndicator.ts";

class Indicator {
  className = "";
  textContent = "";
  readonly attributes = new Map<string, string>();
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("shared completion indicator", () => {
  it.each([false, true])("renders an actual check only for completion (%s)", (complete) => {
    vi.stubGlobal("document", { createElement: () => new Indicator() });
    const node = createCompletionIndicator("Objective", complete) as unknown as Indicator;
    expect(node.attributes.get("aria-checked")).toBe(String(complete));
    expect(node.attributes.get("aria-label")).toBe("Objective");
    expect(node.attributes.get("role")).toBe("checkbox");
    expect(node.attributes.get("aria-disabled")).toBe("true");
    expect(node.textContent).toBe(complete ? "✓" : "");
    expect(node.className).toBe("ada-completion");
    expect(COMPLETION_INDICATOR.complete).not.toBe(COMPLETION_INDICATOR.incomplete);
    expect(COMPLETION_INDICATOR_STYLE).toContain(`background:${COMPLETION_INDICATOR.complete}`);
    expect(COMPLETION_INDICATOR_STYLE).toContain(`solid ${COMPLETION_INDICATOR.incomplete}`);
  });

  it("routes both true completion consumers through the shared renderer and stylesheet", () => {
    for (const file of ["achievementsCard.ts", "questsScreen.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).toContain('from "./completionIndicator.ts"');
      expect(source).toMatch(/createCompletionIndicator\([^)]*,/);
      expect(source).not.toContain('createElement("input")');
      expect(source).not.toContain(".ada-achievement-badge{");
    }
    const questStyle = readFileSync(new URL("layout/questsScreen.ts", import.meta.url), "utf8");
    expect(questStyle).not.toContain("input:checked");
    const stylesheet = readFileSync(new URL("stylesheet.ts", import.meta.url), "utf8");
    expect(stylesheet).toContain("  COMPLETION_INDICATOR_STYLE,");
  });
});
