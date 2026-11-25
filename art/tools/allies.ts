// The Phantom finale allies' data: allies.json, with the roster (which art draws each ally),
// Marlo's song and the ally jump, linked from Phantom's manifest. The ally craft are friendly
// craft (art/tools/friendly.ts). Contract: art/allies.md.
// Usage: node art/tools/allies.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";

import { linkData } from "./manifest.ts";
import { json } from "./projection.ts";

const OUT = fileURLToPath(new URL("../../public/art/phantom/", import.meta.url));
const PUBLIC = "/art/phantom/";
// Phantom's field (public/art/galaxies.json `phantom`), for the contrast checks.
const FIELD = (
  JSON.parse(readFileSync(new URL("../../public/art/galaxies.json", import.meta.url), "utf8")) as {
    galaxies: Record<string, { colors: { background: string } }>;
  }
).galaxies.phantom!.colors.background;
// Whirlpool whale glow (art/whales.md), the song's colour.
const glow = "#cbb8ee";

// ---------------------------------------------------------------- roster and song

// Which art draws each ally: a story craft name (`craft-{craft}-{k}`, in any manifest) or a whale
// kind (`whale-{kind}-{k}-{f}`, Whirlpool's manifest). Keys are Gameplay's project ids and, for the
// quest allies, galaxy ids.
const ROSTER = {
  projects: {
    greenhouseRing: { craft: "grower" },
    workshopCrane: { craft: "crane" },
    salvageBeacons: { craft: "salvager" },
    nurseryBeacon: { whale: "adult" },
    currentBuoys: { craft: "buoytender" },
    quietCrossing: { craft: "voronguide" },
    channelLights: { craft: "student" },
    loomHall: { craft: "loomship" },
    practiceBerth: { craft: "avipracticeglider" },
    courierSchool: { craft: "trainee" },
    spareBeacon: { craft: "beacontender" },
    routeExchange: { craft: "courierrunner" },
    dockingBay: { craft: "driller" },
    hubRepairs: { craft: "tug" },
  },
  quests: {
    sunflower: { craft: "barge" },
    whirlpool: { whale: "whale" },
    needle: { craft: "reed" },
    andromeda: { craft: "pip" },
    cartwheel: { craft: "miner" },
  },
};

// Marlo's song (gameplay/ships.md "Finale allies"), in the whale glow: only the `quests` ally
// `quest` sings. Reaches are world units: `base`, or `nurseryBeacon` while that project ally
// flies. Widths are logical px, scaled by `s`.
const SONG = {
  quest: "whirlpool",
  reach: { base: 300, nurseryBeacon: 450 },
  color: glow,
  field: { alpha: 0.08 },
  rim: { alpha: 0.78, width: 2 },
  ripples: { alpha: 0.3, width: 2, count: 2, periodMs: 2400 },
  droneRing: { alpha: 1, width: 2, margin: 4 },
};

// The ally jump: the shipped quantum jump's parts (public/art/quantum-jump.json) at ally scale.
// Glow frames display at `glowReference` scale (112 times the ally's display size over Ada's
// 42); iris radii are in ally display sizes; `scale` and `stretch` are about the pivot.
const JUMP = {
  glowReference: 42,
  out: [
    { ms: 50, glow: "full" },
    { ms: 50, glow: "full" },
    { ms: 50, glow: "full" },
    { ms: 80, glow: "full", stretch: 3.2, white: 0.7, star: true },
  ],
  in: [
    { ms: 50, glow: "mid", scale: 1.2, iris: 0.5 },
    { ms: 50, glow: "mid", scale: 1.1, iris: 0.75 },
    { ms: 50, glow: "low", scale: 1.05, iris: 1 },
    { ms: 50, glow: "low", scale: 1, iris: 1.25 },
    { ms: 50, scale: 1, iris: 1.5 },
    { ms: 50, scale: 1, iris: 1.75 },
  ],
  reducedMotion: { fadeMs: 200 },
};

// ---------------------------------------------------------------- export

const ratio = (x: string, y: string) => contrast(x.slice(1), y.slice(1));

writeFileSync(`${OUT}allies.json`, json({ version: 1, roster: ROSTER, song: SONG, jump: JUMP }));

linkData("phantom", { allies: `${PUBLIC}allies.json`, whales: "/art/whales.json" });
console.log(`song colour ${glow} ${ratio(glow, FIELD).toFixed(2)}:1 on ${FIELD}`);
// Each song layer as drawn: the glow at its alpha over the tinted field, against that tint.
const over = (base: string, alpha: number) => {
  const [f, g] = [base, glow].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  return `#${f
    .map((v, i) =>
      Math.round(v + (g![i]! - v) * alpha)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
const tint = over(FIELD, SONG.field.alpha);
console.log(`song field ${tint} ${ratio(tint, FIELD).toFixed(2)}:1 on ${FIELD}`);
// The rim must reach 3:1 and the drone ring 4:1 over the tinted field.
for (const [layer, alpha, floor] of [
  ["rim", SONG.rim.alpha, 3],
  ["ripples", SONG.ripples.alpha, 0],
  ["drone ring", SONG.droneRing.alpha, 4],
] as const) {
  const value = ratio(over(tint, alpha), tint);
  console.log(`song ${layer} ${over(tint, alpha)} ${value.toFixed(2)}:1 over the tint`);
  if (value < floor) {
    throw new Error(`song ${layer} is ${value.toFixed(2)}:1 over the tint, below ${floor}:1`);
  }
}
