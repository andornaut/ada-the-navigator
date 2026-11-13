import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { editManifest } from "./manifest.ts";
import { anchor, json, SHIP_HEADINGS, vector } from "./projection.ts";
import {
  classic,
  DISPLAY,
  drawn,
  FRAME,
  highlight,
  mouthAxis,
  mouthOccluders,
  nose,
  SCHEMES,
  type Scheme,
  UP,
} from "./ship-model.ts";
import { svgPaths } from "./ship-paths.ts";
import { check, rasterize, trace, type V2 } from "./silhouette.ts";

// Writes Ada's ship sprite frames, paint schemes, speed jets, nose and collision from the shared
// model in ship-model.ts.
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));

function svg(yaw: number, thrust: boolean, scheme: Scheme = classic): string {
  const polygons = svgPaths(drawn(FRAME / 2, scheme.paint, { thrust, yaw })).map(
    ({ color, path }) => `  <path fill="${color}" d="${path}"/>`,
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
    `  <title>Ship ${yaw}${thrust ? " thrust" : " idle"}${scheme === classic ? "" : ` ${scheme.name}`}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Speed jet colours by engine level: pale blue at base, orange at level 2, purple at level 3, on
// every paint scheme. Widths, lengths and the halo's alpha ramp are the same at every level.
const JET_LENGTH = { base: 6, scale: 24, exponent: 2 };
const JET_LEVELS = [
  { level: 1, halo: "#70ace8", outer: ["#5b93cc", "#b9ecff"], core: ["#8cc4f0", "#ffffff"] },
  { level: 2, halo: "#ff8f1f", outer: ["#ea6a00", "#ffd59a"], core: ["#ffb24d", "#ffffff"] },
  { level: 3, halo: "#a66bff", outer: ["#8652e7", "#e6ccff"], core: ["#b98cff", "#ffffff"] },
] as const;

function jetLayers({ halo, outer, core }: (typeof JET_LEVELS)[number]) {
  return [
    { name: "halo", color: halo, width: 2.4, length: 1.1, alpha: { from: 0.6, to: 1, max: 0.5 } },
    { name: "outer", colors: outer, width: 1.6, length: 1 },
    { name: "core", colors: core, width: 0.8, length: 0.55 },
  ];
}

// Speed jets: Tech draws halo, outer and core triangles per mouth behind the idle frame, in the
// layers of Ada's engine level.
function jets(): string {
  const layers = JET_LEVELS.flatMap(jetLayers);
  const bounds = {
    width: Math.max(...layers.map((l) => l.width)),
    length: (JET_LENGTH.base + JET_LENGTH.scale) * Math.max(...layers.map((l) => l.length)),
  };
  const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: [-1, 1].map((sign) => {
      const { half, middle } = mouthAxis(sign);
      return {
        anchor: anchor(SHIP_HEADINGS, 48, yaw, middle),
        axis: vector(SHIP_HEADINGS, yaw, [0, 1, 0]),
        occluders: mouthOccluders(bounds, sign, yaw),
        half: vector(SHIP_HEADINGS, yaw, half),
      };
    }),
  }));
  const contract = {
    version: 1,
    frame: 96,
    length: JET_LENGTH,
    engineLevels: JET_LEVELS.map((entry) => ({ level: entry.level, layers: jetLayers(entry) })),
    headings,
  };
  return json(contract);
}

// Douglas-Peucker tolerance for the ship's silhouette, in frame px. The default 0.75 leaves the
// long straight edges of the small hull below the intersection-over-union floor.
const SILHOUETTE_TOLERANCE = 0.5;

// The drawn silhouette of idle heading `yaw` as convex parts in frame px, traced from the
// frame's fills (no strokes, so no growth) and checked against them. Paint schemes share the
// geometry; every scheme must trace to the same parts.
function collision(yaw: number): V2[][] {
  const traced = SCHEMES.map((scheme) => {
    const mask = rasterize(
      drawn(FRAME / 2, scheme.paint, { yaw }).map(({ outline }) => outline),
      FRAME,
      FRAME,
    );
    const { collision: parts, tips } = trace(mask, SILHOUETTE_TOLERANCE);
    if (tips.length) throw new Error(`ship ${yaw} ${scheme.id}: the outline has a notch tip`);
    check(`ship ${yaw} ${scheme.id}`, parts, mask);
    return parts;
  });
  const [first] = traced;
  if (traced.some((parts) => JSON.stringify(parts) !== JSON.stringify(first))) {
    throw new Error(`ship ${yaw}: paint schemes trace to different collision parts`);
  }
  return first!;
}

// Nose and drawn silhouette per heading in frame px, projected like the frames; shots leave
// from the nose.
function noses(): string {
  return json({
    version: 1,
    frame: FRAME,
    displayScale: DISPLAY / FRAME,
    noses: Array.from({ length: SHIP_HEADINGS }, (_, yaw) =>
      anchor(SHIP_HEADINGS, FRAME / 2, yaw, nose()),
    ),
    collision: Array.from({ length: SHIP_HEADINGS }, (_, yaw) => collision(yaw)),
  });
}

mkdirSync(output, { recursive: true });
writeFileSync(`${output}ship-jets.json`, jets());
writeFileSync(`${output}ship-nose.json`, noses());
for (let yaw = 0; yaw < SHIP_HEADINGS; yaw++) {
  for (const thrust of [false, true]) {
    writeFileSync(`${output}ship-${thrust ? "thrust-" : ""}${yaw}.svg`, svg(yaw, thrust));
  }
}
writeFileSync(`${output}ship.svg`, svg(UP, false));
writeFileSync(`${output}ship-thrust.svg`, svg(UP, true));

// Paint schemes: idle frames only; speed jets are unpainted and drawn behind them.
const painted = SCHEMES.filter((scheme) => scheme !== classic);
for (const scheme of painted) {
  mkdirSync(`${output}paint/${scheme.id}`, { recursive: true });
  for (let yaw = 0; yaw < SHIP_HEADINGS; yaw++) {
    writeFileSync(`${output}paint/${scheme.id}/ship-${yaw}.svg`, svg(yaw, false, scheme));
  }
}
writeFileSync(
  `${output}ship-paint.json`,
  json({
    version: 1,
    schemes: SCHEMES.map(({ id, name, paint }) => ({
      id,
      name,
      ...paint,
      canopyHighlight: highlight(paint.canopyRoof),
    })),
  }),
);

// Ship entries open the manifest: the up aliases, then idle and thrust per heading, then
// the paint frames, which mirror ship-N with their own path and a paint id.
const entry = (id: string, path: string, yaw: number) => ({
  id,
  path,
  width: FRAME,
  height: FRAME,
  displayWidth: DISPLAY,
  displayHeight: DISPLAY,
  facing: `world-${yaw}`,
  directionIndex: yaw,
  pivot: { x: 0.5, y: 0.5 },
});
const yaws = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => yaw);
const entries = [
  entry("ship", "/art/ship.svg", UP),
  entry("ship-thrust", "/art/ship-thrust.svg", UP),
  ...yaws.flatMap((yaw) => [
    entry(`ship-${yaw}`, `/art/ship-${yaw}.svg`, yaw),
    entry(`ship-thrust-${yaw}`, `/art/ship-thrust-${yaw}.svg`, yaw),
  ]),
  ...painted.flatMap((scheme) =>
    yaws.map((yaw) => ({
      ...entry(`ship-${scheme.id}-${yaw}`, `/art/paint/${scheme.id}/ship-${yaw}.svg`, yaw),
      paint: scheme.id,
    })),
  ),
];
const isShip = ({ id }: { id: string }) => id === "ship" || id.startsWith("ship-");
editManifest("core", (manifest) => {
  manifest.assets = [...entries, ...manifest.assets.filter((asset) => !isShip(asset))];
  manifest.shipNose = "/art/ship-nose.json";
});
