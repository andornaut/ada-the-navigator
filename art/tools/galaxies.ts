// Galaxy hues: each galaxy retints the space field (background, environment and detail) to one
// Oklab hue and chroma, keeping each role's lightness offset; signals keep their colours. A light
// galaxy mirrors the role steps below its background and carries the light-field rule. Each
// galaxy also takes a route-map marker colour.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";
import { format, resolveConfig } from "prettier";

import { linkData } from "./manifest.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { json } from "./projection.ts";
import { jetLayers, LIGHT_FIELD_JET_LEVELS } from "./ship-jet-layers.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

const FIELD = ["background", "environment", "environmentDetail"] as const;
const SIGNALS = [
  "pointOfInterest",
  "obstacle",
  "active",
  "weapon",
  "shipHardpoint",
  "ammo",
] as const;
const MIN_CONTRAST = 5;
const INK = "#181425";
const FOREGROUND_EDGES: Readonly<Record<string, string>> = { phantom: "#FFFFFF" };

type Tint = { lightness: number; chroma: number; hue: number; light?: true };

// Galaxies by stable id, in id order. Route order, numbers, names and flavour lines are
// Gameplay's. Sunflower's background is Chibi's farm yellow #D8C994.
const GALAXIES: Readonly<Record<string, Tint>> = {
  andromeda: { lightness: 0, chroma: 0.05, hue: 278 },
  cartwheel: { lightness: 0, chroma: 0.036, hue: 30 },
  needle: { lightness: -0.025, chroma: 0.008, hue: 60 },
  phantom: { lightness: -0.05, chroma: 0.034, hue: 320 },
  sunflower: { lightness: 0.5549, chroma: 0.0714, hue: 94.2, light: true },
  whirlpool: { lightness: 0, chroma: 0.034, hue: 215 },
};

// Approved field roles: base, facet and accent. Signal and map-marker colours are independent.
const THEMES: Readonly<Record<string, readonly [string, string, string]>> = {
  whirlpool: ["#B8CEC4", "#A6BDB3", "#92ABA1"],
  needle: ["#C6BBA6", "#B3A891", "#9E937E"],
  andromeda: ["#9298B5", "#8087A4", "#6F7693"],
  cartwheel: ["#BC9D90", "#A8897C", "#957569"],
  phantom: ["#514955", "#625868", "#75677B"],
};

// Bank fields by id: tints kept for a later galaxy and assigned to none; Gameplay places them.
const BANK: Readonly<Record<string, Tint>> = {
  "dark-gold": { lightness: 0, chroma: 0.038, hue: 80 },
};

// Route-map markers (art/galaxies.md "Markers"): a light galaxy's marker is its background; a
// dark galaxy's takes Oklab L `lightness` at its tint hue with `chromaScale` times its chroma.
// Every locked marker is one grey, so it gives away no hue. Ink numbers sit on every face.
const MARKER = { lightness: 0.83, chromaScale: 2, locked: "#8B8B8B" } as const;
const MIN_MARKER_INK = 4.5;
const MIN_MARKER_DISTANCE = 0.055;
const MIN_LOCKED_DISTANCE = 0.15;

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
  // Drawn over the keyline: play objects and pickups, then the amber and coral effects.
  keylined: [
    "ship",
    "swarm",
    "fighter",
    "interceptor",
    "retaliator",
    "frigate",
    "capital",
    "asteroid",
    "stardust",
    "discoveryCache",
    "outpost",
    "station",
    "holodisk",
    "upgradePickup",
    "ammoPickup",
    "wreck",
    "beacon",
    "nebulaStars",
    "huntGlint",
    "strandedCraft",
    // Traveling and channel debris: Cartwheel's, Whirlpool's river debris and Needle's channels.
    "debris",
    // Whirlpool's project world changes, whose lamps meet Whirlpool's floor through the keyline.
    "nurseryBeacon",
    "currentBuoy",
    // Enemies outside the drone and heavy archetypes: Gadget's capital, the hostile station and
    // Cartwheel's turret platform.
    "gadget",
    "hostileStation",
    "platform",
    // Non-hostile story craft: Pip, the miner, the visitors, the blocker and Elder Loom's saucer.
    "storyCraft",
    // Scenery and props that are not backdrop: Andromeda's guide beacons, Cartwheel's mooring
    // buoy, the ore pickup, Needle's ring gates and channel lamps, and the whales. The holodisk's
    // waypoint beacon keeps its own rule (`holodiskBeacon`) and takes no keyline.
    "guideBeacon",
    "mooringBuoy",
    "orePickup",
    "needleGate",
    "needleLamp",
    "whale",
  ],
  // A craft's jets join its keyline silhouette (hull, hardpoints, turret tops and drawn jets),
  // except Ada's, which take none (art/ship.md, Speed jets).
  jetKeyline: { join: true, exempt: ["ship"] },
  effects: ["missile", "blastRing", "blastFlash", "hitSpark", "destructionShards", "towClamp"],
  // Places Ada visits take a wider keyline, so they read at a glance on a light field
  // (art/destinations.md): every station, outpost, settlement and story place.
  destinationKeyline: { width: 2, kinds: ["station", "outpost", "storyPlace"] },
  // The status pill's 1 px ink outlines, as on the +N tick.
  hudOutline: { width: 1, parts: ["shieldIcon", "shieldBar"] },
  shotEdge: 1,
  // Ada's Phaser beam: its amber band and amber bloom disc draw over their silhouettes grown by
  // `edge` px in the field's edge colour (art/weapons.md, Phaser beam).
  phaser: { edge: 1 },
  indicatorStroke: 4,
  // Edge markers' ink outline, as the Scattershot dot's (space-palette.md, Edge markers).
  markerOutline: 1,
  jets: {
    // Ada's plume layers by Engine level on a light field.
    shipLevels: LIGHT_FIELD_JET_LEVELS.map((entry) => ({
      level: entry.level,
      layers: jetLayers(entry),
    })),
    enemy: [
      { name: "outer", colors: ["#7f4b3d", "#7f4b3d"], width: 1.6, length: 1 },
      { name: "core", colors: ["#a8654f", "#d68b72"], width: 0.8, length: 0.55 },
    ],
  },
  // The waypoint beacon holds its frame A row, lit, with no pulse.
  holodiskBeacon: "holodisk-beacon-a",
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
    FIELD.map((role, index) => [
      role,
      THEMES[id]?.[index] ?? tint(t, baseBackground, base.colors[role]!),
    ]),
  );
  // The actual emitted recognition edge carries contrast independently of field brightness.
  const foreground = FOREGROUND_EDGES[id];
  const edges: [string, string][] = foreground
    ? [["foreground edge", foreground]]
    : t.light || (THEMES[id] !== undefined && id !== "phantom")
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

function marker(t: Tint, colors: Record<string, string>): string {
  if (t.light) {
    return colors.background!;
  }
  const h = (t.hue * Math.PI) / 180;
  const c = t.chroma * MARKER.chromaScale;
  return hex(fromOklab(MARKER.lightness, c * Math.cos(h), c * Math.sin(h))).toUpperCase();
}

const distance = (a: string, b: string) => {
  const [p, q] = [toOklab(rgb(a)), toOklab(rgb(b))];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

const galaxies = Object.fromEntries(
  Object.entries(GALAXIES).map(([id, t]) => {
    const colors = field(id, t);
    const [L, a, b] = toOklab(rgb(colors.background!));
    const themeTint = THEMES[id]
      ? {
          lightness: L - baseBackground,
          chroma: Math.hypot(a, b),
          hue: (Math.atan2(b, a) * 180) / Math.PI,
          ...(id !== "phantom" ? { light: true } : {}),
        }
      : t;
    return [
      id,
      {
        tint: themeTint,
        colors,
        marker: marker(t, field(`legacy:${id}`, t)),
        ...(FOREGROUND_EDGES[id] ? { foregroundEdge: FOREGROUND_EDGES[id] } : {}),
      },
    ];
  }),
);
const bank = Object.fromEntries(
  Object.entries(BANK).map(([id, t]) => [id, { tint: t, colors: field(id, t) }]),
);

// Ink numbers read on every face; markers stay apart from each other and from the locked grey.
const faces: [string, string][] = [
  ...Object.entries(galaxies).map(([id, g]): [string, string] => [id, g.marker]),
  ["locked", MARKER.locked],
];
for (const [id, m] of faces) {
  const ratio = contrast(m.slice(1), INK.slice(1));
  if (ratio < MIN_MARKER_INK) {
    throw new Error(`ink on the ${id} marker is ${ratio.toFixed(2)}:1, below ${MIN_MARKER_INK}:1`);
  }
}
const ids = Object.keys(galaxies);
for (const [i, a] of ids.entries()) {
  const locked = distance(galaxies[a]!.marker, MARKER.locked);
  if (locked < MIN_LOCKED_DISTANCE) {
    throw new Error(`the ${a} marker is ${locked.toFixed(3)} from the locked grey`);
  }
  for (const b of ids.slice(i + 1)) {
    const d = distance(galaxies[a]!.marker, galaxies[b]!.marker);
    if (d < MIN_MARKER_DISTANCE) {
      throw new Error(`the ${a} and ${b} markers are ${d.toFixed(3)} apart`);
    }
  }
}

const dataPath = `${art}galaxies.json`;
writeFileSync(
  dataPath,
  await format(
    json({
      version: 1,
      fieldPaint: FIELD_PAINT,
      preview: PREVIEW,
      marker: MARKER,
      lightField: LIGHT_FIELD,
      galaxies,
      bank,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

linkData("core", { galaxyFields: "/art/galaxies.json" });
