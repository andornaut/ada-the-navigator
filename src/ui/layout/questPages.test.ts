import { describe, expect, it } from "vitest";

import { questTextParts } from "./questPages.ts";

describe("quest text pages", () => {
  it("continues long prose without losing spaces, Unicode, punctuation or repeated words", () => {
    const text = "The growers’ equipment needs repairs. Food, tools, parts. ".repeat(12);
    const parts = questTextParts((part) => part.length <= 96, text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(text);
    expect(parts.every((part) => part.length <= 96)).toBe(true);
  });
  it("paginates an unbroken string without a nonterminating word search", () => {
    const text = "x".repeat(101);
    const parts = questTextParts((part) => part.length <= 20, text);
    expect(parts.join("")).toBe(text);
    expect(parts.map((part) => part.length)).toEqual([20, 20, 20, 20, 20, 1]);
  });
});
