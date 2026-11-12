import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// A rule's declarations by its exact selector.
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "u").exec(css)?.[1] ?? "";
}

// Every TypeScript and CSS source under src, the UI's CSS strings included.
function sources(dir: URL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) {
      return sources(url);
    }
    return /\.(ts|css)$/u.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [readFileSync(url, "utf8")]
      : [];
  });
}

describe("tap highlight", () => {
  it("is transparent at the game page's root and the landing page's body", () => {
    expect(rule(read("../style.css"), "html")).toContain(
      "-webkit-tap-highlight-color: transparent",
    );
    expect(rule(read("../../public/site.css"), "body.site")).toContain(
      "-webkit-tap-highlight-color: transparent",
    );
  });

  it("is inherited by every button, disc, stick target and Map control: nothing sets another", () => {
    const declarations = sources(new URL("../", import.meta.url)).flatMap((source) => [
      ...source.matchAll(/-webkit-tap-highlight-color\s*:\s*([^;}\n]+)/gu),
    ]);
    expect(declarations.length).toBeGreaterThan(0);
    for (const [, value] of declarations) {
      expect(value?.trim()).toBe("transparent");
    }
  });
});
