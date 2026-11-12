// Whirlpool's currents, debris rivers and project world changes (art/whirlpool.md): the current
// streak spec Tech draws at runtime (currents.json), the river debris, a bent plate and a broken
// girder in the Whirlpool field hue inside the coral hazard contour (SVG frames and debris.json),
// and the nursery beacon and current-map buoys (SVG frames and projects.json), written to
// public/art/whirlpool/ with their entries and links in Whirlpool's manifest.
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
import { linkData, replaceEntries } from "./manifest.ts";
import { json } from "./projection.ts";
import {
  BUOY,
  CREAM,
  exportProject,
  GLASS,
  LAMP,
  NURSERY,
  NURSERY_FRAME_MS,
  POOL_COLOR,
  PROJECTS,
} from "./whirlpool-projects.ts";

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
      { tint: { chroma: number; hue: number }; colors: Record<string, string> }
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

// ------------------------------------------------------------------ project world changes

const projectEntries = [
  ...exportProject(dir, PUBLIC_DIR, "nurseryBeacon", NURSERY, NURSERY_FRAME_MS),
  ...exportProject(dir, PUBLIC_DIR, "currentBuoys", BUOY),
];

// The lit beacon glass and buoy lamp read as signals on the field; the cream body stays clear.
const MIN_LIGHT_ON_FIELD = 5;
for (const [name, colour] of [
  ["beacon glass A", GLASS.a[2]!],
  ["beacon glass B", GLASS.b[2]!],
  ["buoy lamp A", LAMP.a[3]!],
  ["cream body", CREAM[1]!],
] as const) {
  const value = ratio(colour, BACKGROUND);
  if (value < MIN_LIGHT_ON_FIELD) {
    throw new Error(
      `${name} ${colour} on field is ${value.toFixed(2)}:1, below ${MIN_LIGHT_ON_FIELD}:1`,
    );
  }
}

// The light pool's innermost composite: every ring at frame A's alpha over the field.
function poolComposite(alpha: number): string {
  const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const top = channels(POOL_COLOR);
  const base = PROJECTS.nurseryBeacon.pool.radii.reduce(
    (under) => under.map((c, i) => c + (top[i]! - c) * alpha),
    channels(BACKGROUND),
  );
  return `#${base.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

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
await writeJson(`${dir}projects.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  reducedMotion: { frame: 0 },
  projects: PROJECTS,
});

// Every whirlpool- entry but the station's (whirlpool-station.ts), in place.
replaceEntries(
  "whirlpool",
  (id) => id.startsWith("whirlpool-") && !id.startsWith("whirlpool-station-"),
  [...pieces.flatMap(({ entries }) => entries), ...projectEntries],
);

// Whirlpool's manifest names the streak and debris data after the whale data.
linkData("whirlpool", {
  whirlpoolCurrents: "/art/whirlpool/currents.json",
  whirlpoolDebris: "/art/whirlpool/debris.json",
  whirlpoolProjects: "/art/whirlpool/projects.json",
});

const report = {
  streakOnField: ratio(STREAKS.color, BACKGROUND),
  whaleOnStreak,
  whaleOnField: ratio(whaleTop, BACKGROUND),
  contourOnField: ratio(CORAL, BACKGROUND),
  contourOnStreak: ratio(CORAL, STREAKS.color),
  contourOnBody: BODY.map((tone) => ratio(CORAL, tone)),
  bodyOnField: BODY.map((tone) => ratio(tone, BACKGROUND)),
  creamOnField: CREAM.map((tone) => ratio(tone, BACKGROUND)),
  glassOnField: [GLASS.a[2]!, GLASS.b[2]!].map((tone) => ratio(tone, BACKGROUND)),
  lampOnField: [LAMP.a[3]!, LAMP.b[2]!].map((tone) => ratio(tone, BACKGROUND)),
  poolInnerOnField: [ratio(poolComposite(PROJECTS.nurseryBeacon.pool.alpha[0]), BACKGROUND)],
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
