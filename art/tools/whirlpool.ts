// Whirlpool's currents and debris rivers (art/whirlpool.md): the current streak spec Tech draws
// at runtime (currents.json) and the river debris, a bent plate and a broken girder in the
// Whirlpool field hue inside the coral hazard contour (SVG frames and debris.json), written to
// public/art/whirlpool/ with their root manifest entries and links.
// Usage: node art/tools/whirlpool.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";
import { format, resolveConfig } from "prettier";

import { DISPLAY_SCALE } from "./crafts.ts";
import {
  bentPlate,
  bodyRamp,
  brokenGirder,
  CONTOUR,
  exportDebris,
  MARK_DASHES,
  MARK_WIDTH,
  TUMBLE_DEG_PER_SECOND,
  TUMBLE_FRAMES,
  unit,
} from "./debris.ts";
import { placeEntries } from "./manifest.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dir = `${art}whirlpool/`;
const PUBLIC_DIR = "/art/whirlpool/";
mkdirSync(dir, { recursive: true });

const palette = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const whirlpool = (
  JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
    galaxies: {
      id: string;
      tint: { chroma: number; hue: number };
      colors: Record<string, string>;
    }[];
  }
).galaxies.find(({ id }) => id === "whirlpool")!;
// The whale's lit hull tone, the lightest part of it that crosses a streak.
const whaleTop = (
  JSON.parse(readFileSync(`${art}whales.json`, "utf8")) as { palette: { hull: string[] } }
).palette.hull[0]!;

const CORAL = palette.colors.obstacle!;
const BACKGROUND = whirlpool.colors.background!;

// ------------------------------------------------------------------ current streaks

// Chevron streaks on the world plane. `f` is the local flow over the peak flow at a mark; a pair
// [a, b] means a + b f. Lengths are world units, stroke widths logical px.
const STREAKS = {
  color: "#296362",
  // Marks with f at or below this are not drawn.
  minFlow: 0.06,
  // Lane count max(min, round(width / spacing)); lane j's offset is jittered by up to `jitter`
  // lane widths, the sign and size from frac(j * jitterStep).
  lanes: { spacing: 46, min: 3, jitter: 0.12, jitterStep: 0.618034 },
  // Rows `spacing` apart along the path; odd lanes shift `stagger` rows, and lane j a further
  // `phase` * frac(j * phaseStep) rows.
  rows: { spacing: 64, stagger: 0.5, phase: 0.3, phaseStep: 0.414214 },
  // Arm reach; the tip sits `tip` reaches ahead of the mark, the arm ends `back` reaches behind
  // it and one reach to each side.
  chevron: { arm: [6, 7], tip: 0.6, back: 0.6 },
  stroke: [1.1, 0.7],
  alpha: [0.3, 0.7],
  join: "round",
  cap: "butt",
  // Reduced motion draws the time-zero frame and holds it.
  reducedMotion: { time: 0 },
} as const;

// The whale's lit hull over a full-strength streak stays readable.
const MIN_WHALE_ON_STREAK = 3;

const ratio = (a: string, b: string) => contrast(a.slice(1), b.slice(1));
const whaleOnStreak = ratio(whaleTop, STREAKS.color);
if (whaleOnStreak < MIN_WHALE_ON_STREAK) {
  throw new Error(
    `whale top ${whaleTop} on streak ${STREAKS.color} is ${whaleOnStreak.toFixed(2)}:1, below ${MIN_WHALE_ON_STREAK}:1`,
  );
}

// ------------------------------------------------------------------ river debris

const BODY = bodyRamp(
  whirlpool.colors.environmentDetail!,
  whirlpool.tint.chroma,
  whirlpool.tint.hue,
);
const pieces = [
  {
    id: "whirlpool-debris-plate",
    title: "Whirlpool debris plate",
    solid: bentPlate(),
    axis: unit([0.4, 1, 0.6]),
    scale: 1.25,
  },
  {
    id: "whirlpool-debris-girder",
    title: "Whirlpool debris girder",
    solid: brokenGirder(),
    axis: unit([1, 0.3, 0.5]),
    scale: 1.15,
  },
].map((spec) => exportDebris(dir, PUBLIC_DIR, BODY, CORAL, spec));

// ------------------------------------------------------------------ output

// JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function writeJson(path: string, value: unknown): Promise<void> {
  writeFileSync(
    path,
    await format(json(value), { ...(await resolveConfig(path)), filepath: path }),
  );
}

await writeJson(`${dir}currents.json`, { version: 1, streaks: STREAKS });
await writeJson(`${dir}debris.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  body: BODY,
  contour: { color: CORAL, width: CONTOUR },
  tumble: { frames: TUMBLE_FRAMES, degPerSecond: TUMBLE_DEG_PER_SECOND },
  marks: { color: CORAL, width: MARK_WIDTH, dashes: MARK_DASHES },
  debris: pieces.map(({ data }) => data),
});

placeEntries(
  "whirlpool-",
  pieces.flatMap(({ entries }) => entries),
);

// The root manifest names the streak and debris data next to the other data files.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
const links = {
  whirlpoolCurrents: "/art/whirlpool/currents.json",
  whirlpoolDebris: "/art/whirlpool/debris.json",
};
if (Object.entries(links).some(([key, path]) => manifest[key] !== path)) {
  writeFileSync(manifestPath, json({ ...manifest, ...links }));
}

const report = {
  streakOnField: ratio(STREAKS.color, BACKGROUND),
  whaleOnStreak,
  whaleOnField: ratio(whaleTop, BACKGROUND),
  contourOnField: ratio(CORAL, BACKGROUND),
  contourOnStreak: ratio(CORAL, STREAKS.color),
  contourOnBody: BODY.map((tone) => ratio(CORAL, tone)),
  bodyOnField: BODY.map((tone) => ratio(tone, BACKGROUND)),
};
console.log(
  JSON.stringify(
    { body: BODY, radius: pieces.map(({ data }) => [data.id, data.radius, data.display]) },
    null,
    0,
  ),
);
console.log(
  Object.entries(report)
    .map(
      ([k, v]) =>
        `${k} ${[v]
          .flat()
          .map((x) => x.toFixed(2))
          .join(" ")}`,
    )
    .join("\n"),
);
