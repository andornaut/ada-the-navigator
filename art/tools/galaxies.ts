// Galaxy hues: each galaxy retints the space field (background, environment and detail) to one
// Oklab hue and chroma, keeping each role's lightness offset; signals keep their colours. A light
// galaxy mirrors the role steps below its background and carries the light-field rule.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

const FIELD = ["background", "environment", "environmentDetail"] as const;
const SIGNALS = ["pointOfInterest", "obstacle", "active", "weapon", "shipHardpoint"] as const;
const MIN_CONTRAST = 5;
const INK = "#181425";

type Tint = { lightness: number; chroma: number; hue: number; light?: true };

// Galaxy order is the selector's page order. Names are ids only; Gameplay owns display strings.
// Sunflower's background is Chibi's farm yellow #D8C994.
const GALAXIES: readonly { id: string; tint: Tint }[] = [
  { id: "sunflower", tint: { lightness: 0.5549, chroma: 0.0714, hue: 94.2, light: true } },
  { id: "cartwheel", tint: { lightness: 0, chroma: 0.036, hue: 30 } },
  { id: "whirlpool", tint: { lightness: 0, chroma: 0.034, hue: 215 } },
  { id: "black-eye", tint: { lightness: -0.055, chroma: 0.04, hue: 335 } },
];

// Bank fields: tints kept for a later galaxy and assigned to none; Gameplay places them.
const BANK: readonly { id: string; tint: Tint }[] = [
  { id: "dark-gold", tint: { lightness: 0, chroma: 0.038, hue: 80 } },
];

// Field paint: Oklab lightness below 0.45 and chroma below 0.06.
const FIELD_PAINT = { lightness: 0.45, chroma: 0.06 } as const;

// The selector's preview: a half-scale crop of a HUD-free capture in the galaxy's own field;
// locked previews map its ITU-R 601 luma Y to offset + scale * Y.
const PREVIEW = {
  crop: { width: 360, height: 180 },
  width: 180,
  height: 90,
  locked: { offset: 30, scale: 0.6 },
};

// The light-field rule (art/galaxies.md "Light fields"), drawn by Tech in a light galaxy. Widths
// are logical px; the jet layers replace the ship's and the enemies' jet layers.
const LIGHT_FIELD = {
  ink: INK,
  keyline: 1,
  shotEdge: 1,
  phaser: { glow: { width: [6.5, 4], alpha: 0.9 }, bloom: { radius: 5, alpha: 0.6 } },
  indicatorStroke: 4,
  jets: {
    ship: [
      { name: "outer", colors: ["#1767b3", "#1767b3"], width: 1.6, length: 1 },
      { name: "core", colors: ["#2585d0", "#64caff"], width: 0.8, length: 0.55 },
    ],
    enemy: [
      { name: "outer", colors: ["#7f4b3d", "#7f4b3d"], width: 1.6, length: 1 },
      { name: "core", colors: ["#a8654f", "#d68b72"], width: 0.8, length: 0.55 },
    ],
  },
  holodiskBeacon: "base",
} as const;

const lightnessOf = (colour: string) => toOklab(rgb(colour))[0];

// A role keeps its Oklab L step from the base background; a light tint mirrors the step below it.
function tint({ chroma, hue, light, lightness }: Tint, background: number, colour: string): string {
  const L = lightnessOf(colour);
  const stepped = light ? 2 * background - L : L;
  const h = (hue * Math.PI) / 180;
  return hex(
    fromOklab(stepped + lightness, chroma * Math.cos(h), chroma * Math.sin(h)),
  ).toUpperCase();
}

const base = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const baseBackground = lightnessOf(base.colors.background!);
function field(id: string, t: Tint): Record<string, string> {
  const colors = Object.fromEntries(
    FIELD.map((role) => [role, tint(t, baseBackground, base.colors[role]!)]),
  );
  // On a light field every play object sits in an ink keyline, so the keyline carries the signal.
  const edges: [string, string][] = t.light
    ? [["ink keyline", INK]]
    : SIGNALS.map((signal) => [signal, base.colors[signal]!]);
  for (const [name, edge] of edges) {
    const ratio = contrast(colors.background!.slice(1), edge.slice(1));
    if (ratio < MIN_CONTRAST) {
      throw new Error(`${name} on ${id} is ${ratio.toFixed(2)}:1, below ${MIN_CONTRAST}:1`);
    }
  }
  return colors;
}

const galaxies = GALAXIES.map(({ id, tint: t }, i) => ({
  number: i + 1,
  id,
  tint: t,
  colors: field(id, t),
}));
const bank = BANK.map(({ id, tint: t }) => ({ id, tint: t, colors: field(id, t) }));
writeFileSync(
  `${art}galaxies.json`,
  json({
    version: 1,
    fieldPaint: FIELD_PAINT,
    preview: PREVIEW,
    lightField: LIGHT_FIELD,
    galaxies,
    bank,
  }),
);

const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { galaxies?: string };
manifest.galaxies = "/art/galaxies.json";
writeFileSync(manifestPath, json(manifest));
