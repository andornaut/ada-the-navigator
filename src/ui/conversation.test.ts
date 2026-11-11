import { describe, expect, it } from "vitest";

import { CONVERSATION_STYLE } from "./conversation.ts";

// The box's rules, by selector, from its stylesheet.
function rules(css: string): Map<string, string> {
  return new Map(
    Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/gu), ([, selector = "", body = ""]) => [
      selector.trim(),
      body.replace(/\s+/gu, ""),
    ]),
  );
}

describe("conversation box style", () => {
  const css = rules(CONVERSATION_STYLE);

  it("moves only the portrait for a right-side speaker", () => {
    const sided = [...css].filter(([selector]) => selector.includes('[data-side="right"]'));
    expect(sided).toEqual([['.ada-conversation[data-side="right"]', "flex-direction:row-reverse"]]);
  });

  it("starts the name tab on the text column's left edge and left-aligns the line", () => {
    expect(css.get(".ada-conversation-name")).toContain("align-self:flex-start");
    expect(css.get(".ada-conversation")).toContain("text-align:left");
    expect(CONVERSATION_STYLE).not.toMatch(/text-align:\s*right|flex-end/u);
  });
});
