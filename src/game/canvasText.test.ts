import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The canvas draws only the world; every word the player reads is HTML over it.
const TEXT = [
  /\.(add|make)\s*\.\s*(text|bitmapText|dynamicBitmapText|rexBBCodeText)\s*\(/u,
  /\bGameObjects\s*\.\s*(Text|BitmapText|DynamicBitmapText)\b/u,
  /\.(fillText|strokeText|measureText)\s*\(/u,
  /\bnew\s+(Phaser\.)?(Text|BitmapText)\s*\(/u,
];

describe("canvas", () => {
  it("draws no text in any form: no text objects and no text painted into textures", () => {
    const game = new URL("./", import.meta.url);
    const offenders = readdirSync(game)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => {
        const source = readFileSync(new URL(file, game), "utf8");
        return TEXT.some((pattern) => pattern.test(source));
      });
    expect(offenders).toEqual([]);
  });

  it("catches each way of putting text on the canvas", () => {
    for (const source of [
      "this.add.text(0, 0, 'x')",
      "this.make.bitmapText({})",
      "new Phaser.GameObjects.Text(scene, 0, 0, 'x')",
      "context.fillText('x', 0, 0)",
      "probe.measureText('x')",
    ]) {
      expect(
        TEXT.some((pattern) => pattern.test(source)),
        source,
      ).toBe(true);
    }
  });
});
