// Whirlpool's currents and debris rivers (art/whirlpool.md): the current streak spec Tech draws at
// runtime (currents.json) and the river debris, an arm segment and a drum slice in the Whirlpool
// field hue inside the coral hazard contour (SVG frames and debris.json), written to
// public/art/whirlpool/ with their entries and links in Whirlpool's manifest. The project world
// changes are friendly objects (art/tools/friendly.ts).
// Usage: node art/tools/whirlpool.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";
import { format, resolveConfig } from "prettier";

import { DISPLAY_SCALE } from "./crafts.ts";
import {
  armSegment,
  bodyRamp,
  CONTOUR,
  debrisPaint,
  drumSlice,
  exportDebris,
  MARK_DASHES,
  MARK_WIDTH,
  TUMBLE_DEG_PER_SECOND,
  TUMBLE_FRAMES,
} from "./debris.ts";
import { writeDebrisFrames } from "./debris-sheets.ts";
import { linkData, mergeEntries } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
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
    galaxies: Record<
      string,
      { tint: { chroma: number; hue: number; light?: boolean }; colors: Record<string, string> }
    >;
  }
).galaxies.whirlpool!;
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
const PAINT = debrisPaint(BODY);
const debrisSvg = new Map<string, string>();
const pieces = [
  {
    id: "whirlpool-debris-plate",
    title: "Whirlpool debris plate",
    mesh: armSegment(PAINT),
    scale: 0.84,
    frame: { width: 118, height: 115, top: 58 },
  },
  {
    id: "whirlpool-debris-girder",
    title: "Whirlpool debris girder",
    mesh: drumSlice(PAINT),
    scale: 0.92,
    frame: { width: 108, height: 95, top: 46 },
  },
].map((spec) =>
  exportDebris(dir, PUBLIC_DIR, CORAL, spec, (file, svg) => {
    debrisSvg.set(`${file}.svg`, svg);
  }),
);

// ------------------------------------------------------------------ output

// JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function writeJson(path: string, value: unknown): Promise<void> {
  writeFileSync(
    path,
    await format(json(value), { ...(await resolveConfig(path)), filepath: path }),
  );
}

await writeJson(`${dir}currents.json`, { version: 1, streaks: STREAKS });
// The staged streak look (art/whirlpool.md, Ordered darts): solid darts on even lanes and rows,
// in three flat size and alpha steps of the flow.
stageRows("runtime-currents", {
  file: "/art/whirlpool/currents.json",
  streaks: {
    lanes: { spacing: 56, min: STREAKS.lanes.min, jitter: 0 },
    rows: { spacing: 72, stagger: 0.5, phase: 0 },
    // A filled dart of arm `a`: (-back a, -a), (tip a, 0), (-back a, a), (-notch a, 0), along
    // the flow and across it.
    dart: { arm: [6, 7], tip: 0.6, back: 0.6, notch: 0.05 },
    // The dart's size step `q` by flow: arm `arm[0] + arm[1] q`, alpha `alpha[0] + alpha[1] q`.
    steps: [
      { flow: 0, q: 0.3 },
      { flow: 0.34, q: 0.65 },
      { flow: 0.67, q: 1 },
    ],
    alpha: [0.3, 0.5],
  },
});
await writeJson(`${dir}debris.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  body: BODY,
  contour: { color: CORAL, width: CONTOUR },
  tumble: { frames: TUMBLE_FRAMES, degPerSecond: TUMBLE_DEG_PER_SECOND },
  marks: { color: CORAL, width: MARK_WIDTH, dashes: MARK_DASHES },
  debris: pieces.map(({ data }) => data),
});
// The river debris rows keep their places in Whirlpool's manifest.
mergeEntries(
  "whirlpool",
  (id) => id.startsWith("whirlpool-debris-"),
  writeDebrisFrames(
    "whirlpool",
    pieces.flatMap(({ entries }) => entries),
    debrisSvg,
  ),
);

// Whirlpool's manifest names the streak and debris data after the whale data.
linkData("whirlpool", {
  whirlpoolCurrents: "/art/whirlpool/currents.json",
  whirlpoolDebris: "/art/whirlpool/debris.json",
});

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
