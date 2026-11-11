// Galaxy hues: each galaxy retints the space field (background, environment and detail) to one
// Oklab hue and chroma, keeping each role's lightness offset; signals keep their colours.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

const FIELD = ["background", "environment", "environmentDetail"] as const;
const SIGNALS = ["pointOfInterest", "obstacle", "active", "weapon", "shipHardpoint"] as const;
const MIN_CONTRAST = 5;

// Galaxy order is the selector's page order. Names are ids only; Gameplay owns display strings.
const GALAXIES = [
  { id: "sunflower", tint: { lightness: 0, chroma: 0.038, hue: 80 } },
  { id: "cartwheel", tint: { lightness: 0, chroma: 0.036, hue: 30 } },
  { id: "whirlpool", tint: { lightness: 0, chroma: 0.034, hue: 215 } },
  { id: "black-eye", tint: { lightness: -0.055, chroma: 0.04, hue: 335 } },
] as const;

// Field paint: Oklab lightness below 0.45 and chroma below 0.06.
const FIELD_PAINT = { lightness: 0.45, chroma: 0.06 } as const;

// The selector's preview: a half-scale crop of a HUD-free capture in the base field, tinted when
// unlocked; locked previews map its ITU-R 601 luma Y to offset + scale * Y.
const PREVIEW = {
  crop: { width: 360, height: 180 },
  width: 180,
  height: 90,
  locked: { offset: 30, scale: 0.6 },
};

type Tint = { lightness: number; chroma: number; hue: number };

function tint({ chroma, hue, lightness }: Tint, colour: string): string {
  const [L] = toOklab(rgb(colour));
  const h = (hue * Math.PI) / 180;
  return hex(fromOklab(L + lightness, chroma * Math.cos(h), chroma * Math.sin(h))).toUpperCase();
}

const base = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const galaxies = GALAXIES.map(({ id, tint: t }, i) => {
  const colors = Object.fromEntries(FIELD.map((role) => [role, tint(t, base.colors[role]!)]));
  for (const signal of SIGNALS) {
    const ratio = contrast(colors.background!.slice(1), base.colors[signal]!.slice(1));
    if (ratio < MIN_CONTRAST) {
      throw new Error(`${signal} on ${id} is ${ratio.toFixed(2)}:1, below ${MIN_CONTRAST}:1`);
    }
  }
  return { number: i + 1, id, tint: t, colors };
});
writeFileSync(
  `${art}galaxies.json`,
  json({ version: 1, fieldPaint: FIELD_PAINT, preview: PREVIEW, galaxies }),
);

const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { galaxies?: string };
manifest.galaxies = "/art/galaxies.json";
writeFileSync(manifestPath, json(manifest));
