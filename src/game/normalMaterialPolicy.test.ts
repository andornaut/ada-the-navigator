import { describe, expect, it } from "vitest";

import art from "../../public/art/ship-jets.json";
import { jetShapeLayerAlpha, jetShapeLayerColor } from "./jetGeometry.ts";
import { engineJets, jetTriangles, layerColor, readEngineJets, readJetLayers } from "./shipJets.ts";

const normal = { normalAperture: { coreWidth: 6.875 / 18.72 } };
const layer = { alpha: { from: 0, max: 0.4, to: 1 }, length: 1, name: "halo", width: 1 };

describe("pure normal material policy", () => {
  it("keeps core-only and legacy alpha while making only the first normal non-core layer solid", () => {
    for (const f of [0, -1]) {
      expect(jetShapeLayerAlpha(normal, layer, 0, f)).toBe(0);
      expect(jetShapeLayerAlpha({}, layer, 0, f)).toBe(0);
    }
    for (const f of [0.2, 0.8, 1]) {
      expect(jetShapeLayerAlpha(normal, layer, 0, f)).toBe(1);
      expect(jetShapeLayerAlpha(normal, layer, 1, f)).toBeCloseTo(0.4 * f, 12);
      expect(jetShapeLayerAlpha({}, layer, 0, f)).toBeCloseTo(0.4 * f, 12);
      expect(jetShapeLayerAlpha(normal, { ...layer, name: "core" }, 0, f)).toBeCloseTo(0.4 * f, 12);
    }
  });

  it("shares typed authored colour selection with string and numeric consumers including black", () => {
    expect(
      jetShapeLayerColor(normal, { name: "halo", normalColor: "authored" }, 0, "fallback"),
    ).toBe("authored");
    expect(jetShapeLayerColor(normal, { name: "outer", normalColor: 0 }, 0, 17)).toBe(0);
    expect(jetShapeLayerColor(normal, { name: "core", normalColor: 0 }, 0, 17)).toBe(17);
    expect(jetShapeLayerColor(normal, { name: "outer", normalColor: 0 }, 1, 17)).toBe(17);
    expect(jetShapeLayerColor({}, { normalColor: 0 }, 0, 17)).toBe(17);
    expect(jetShapeLayerColor(normal, {}, 0, 17)).toBe(17);
  });

  it("parses optional authored hex colour and rejects malformed present values", () => {
    const raw: Record<string, unknown> = { ...art.engineLevels[0]!.layers[0]! };
    Reflect.deleteProperty(raw, "normalColor");
    expect(readJetLayers([{ ...raw, normalColor: "#000000" }])![0]!.normalColor).toBe(0);
    expect(readJetLayers([{ ...raw }])![0]).not.toHaveProperty("normalColor");
    for (const normalColor of [null, 0, "red", "#fff", "#1234567", {}]) {
      expect(readJetLayers([{ ...raw, normalColor }])).toBeUndefined();
    }
  });

  it("uses parsed normal colour only on the first normal layer and retains interpolated runtime fallback", () => {
    const parsed = readEngineJets({
      ...art,
      engineLevels: art.engineLevels.map((entry) => ({
        ...entry,
        layers: entry.layers.map((entry) => ({ ...entry, normalColor: "#000000" })),
      })),
    })!;
    const selected = engineJets(parsed, 1);
    const mouth = { anchor: { x: 0, y: 0 }, axis: { x: 0, y: 1 }, half: { x: 1, y: 0 } };
    const display = {
      displayHeight: parsed.frame,
      displayWidth: parsed.frame,
      pivot: { x: 0, y: 0 },
    };
    for (const profile of [false, true]) {
      const geometry = { ...selected, headings: [[{ ...mouth, ...(profile ? normal : {}) }]] };
      const triangles = jetTriangles(geometry, display, 0, 0.8);
      expect(triangles).toHaveLength(selected.layers.length);
      triangles.forEach((triangle, index) => {
        expect(triangle.color).toBe(
          profile && index === 0 ? 0 : layerColor(selected.layers[index]!, 0.8),
        );
      });
      const core = selected.layers.find((entry) => entry.name === "core")!;
      const onlyCore = jetTriangles({ ...geometry, layers: [core] }, display, 0, 0.8);
      expect(onlyCore[0]!.color).toBe(layerColor(core, 0.8));
    }
  });
});
