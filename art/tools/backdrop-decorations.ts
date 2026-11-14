// Rare decorative compositions: muted native SVG forms, using each galaxy's existing planet palette.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ManifestFile, replaceEntries } from "./manifest.ts";

type GalaxyId = Exclude<ManifestFile, "core">;

export interface DecorationRecipe {
  readonly parallax: number;
  readonly chunk: readonly [number, number];
  readonly chance: number;
  readonly salt: string;
  readonly scale: readonly [number, number];
  readonly rotation: readonly [number, number];
  readonly sprites: readonly { asset: string; width: number; height: number }[];
}

/** Display geometry and placement are shared by the runtime and native Art proofs. */
export function decorationRecipe(galaxy: GalaxyId): DecorationRecipe {
  return {
    parallax: 0.08,
    chunk: [4200, 3000],
    chance: 0.35,
    salt: "rare-decoration",
    scale: [0.9, 1.08],
    rotation: [-18, 18],
    sprites: [1, 2, 3].map((variant) => ({
      asset: `backdrop-decoration-${galaxy}-${variant}`,
      width: 2200,
      height: 1650,
    })),
  };
}

/** Write only the galaxy's rare decoration assets and matching manifest entries. */
export function writeDecorations(
  palette: Readonly<Record<string, string>>,
  galaxy: GalaxyId,
): void {
  const colours = {
    body: palette.body!,
    lit: palette.lit!,
    night: palette.night!,
    ring: palette.ring!,
  };
  const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const entries = decorationRecipe(galaxy).sprites.map((sprite, variant) => {
    const path = `/art/${galaxy}/decoration-${variant + 1}.svg`;
    writeFileSync(`${art}${path.slice("/art/".length)}`, decorationSvg(colours, galaxy, variant));
    return {
      id: sprite.asset,
      path,
      width: 1024,
      height: 768,
      kind: "backdrop-decoration",
      facing: "fixed",
      pivot: { x: 0.5, y: 0.5 },
    };
  });
  replaceEntries(galaxy, (id) => id.startsWith(`backdrop-decoration-${galaxy}-`), entries);
}

type Colours = { body: string; lit: string; night: string; ring: string };
const tau = Math.PI * 2;
const n = (v: number) => Number(v.toFixed(2));
const polygon = (points: readonly (readonly [number, number])[], fill: string) =>
  `<polygon fill="${fill}" points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}"/>`;
const path = (d: string, fill: string) => `<path fill="${fill}" d="${d}"/>`;
const around = (x: number, y: number, r: number, count = 14) =>
  Array.from(
    { length: count },
    (_, i) =>
      [n(x + Math.cos((i * tau) / count) * r), n(y + Math.sin((i * tau) / count) * r)] as const,
  );
function fragment(
  c: Colours,
  x: number,
  y: number,
  r: number,
  stretch: number,
  rotation: number,
  seed: number,
) {
  const points = Array.from({ length: 7 }, (_, i) => {
    const a = (i * tau) / 7 + rotation;
    const reach = r * (0.86 + 0.14 * Math.sin(seed * 1.7 + i * 4.1));
    return [n(x + Math.cos(a) * reach * stretch), n(y + Math.sin(a) * reach)] as const;
  });
  return (
    polygon(points, c.body) +
    polygon([points[0]!, points[1]!, points[2]!, [x, y]], c.lit) +
    polygon([points[3]!, points[4]!, points[5]!, [x, y]], c.night)
  );
}
function planet(
  c: Colours,
  x: number,
  y: number,
  r: number,
  id: string,
  gas = false,
  eclipse = false,
) {
  const outline = polygon(around(x, y, r), "white");
  let ink =
    `<defs><clipPath id="${id}">${outline}</clipPath></defs><g clip-path="url(#${id})">` +
    polygon(around(x, y, r), c.body);
  if (gas) {
    ink += path(
      `M${x - r * 1.2} ${y - r * 0.52} Q${x} ${y + r * 0.1} ${x + r * 1.2} ${y - r * 0.18} L${x + r * 1.2} ${y + r * 0.02} Q${x} ${y + r * 0.36} ${x - r * 1.2} ${y - r * 0.3} Z`,
      c.lit,
    );
    ink += path(
      `M${x - r * 1.2} ${y + r * 0.16} Q${x} ${y + r * 0.73} ${x + r * 1.2} ${y + r * 0.35} L${x + r * 1.2} ${y + r * 0.58} Q${x} ${y + r * 0.98} ${x - r * 1.2} ${y + r * 0.4} Z`,
      c.ring,
    );
  }
  ink += `<ellipse cx="${x + r * (eclipse ? 0.11 : 0.45)}" cy="${y + r * 0.12}" rx="${r * (eclipse ? 0.94 : 0.88)}" ry="${r * 1.04}" fill="${c.night}"/>`;
  return ink + "</g>";
}
function rings(
  c: Colours,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  front = false,
) {
  const transform = `transform="rotate(${angle} ${x} ${y})"`;
  return front
    ? `<g ${transform}><path d="M${x - rx} ${y} A${rx} ${ry} 0 0 0 ${x + rx} ${y}" fill="none" stroke="${c.ring}" stroke-width="13"/><path d="M${x - rx * 0.88} ${y} A${rx * 0.88} ${ry * 0.82} 0 0 0 ${x + rx * 0.88} ${y}" fill="none" stroke="${c.body}" stroke-width="20"/></g>`
    : `<g ${transform}><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${c.ring}" stroke-width="13"/><ellipse cx="${x}" cy="${y}" rx="${rx * 0.88}" ry="${ry * 0.82}" fill="none" stroke="${c.body}" stroke-width="20"/></g>`;
}
function spiral(c: Colours, variant: number) {
  let ink = "";
  for (let arm = 0; arm < 3; arm++)
    for (let i = 0; i < 10; i++) {
      const r = 70 + i * 42,
        a = (arm * tau) / 3 + i * 0.23 + variant * 0.18;
      ink += fragment(
        c,
        512 + Math.cos(a) * r,
        384 + Math.sin(a) * r * 0.66,
        22 + i * 1.7,
        1.3,
        a,
        i + arm * 13,
      );
    }
  for (const [x, y] of [
    [246, 260],
    [756, 480],
  ])
    for (let i = 0; i < 5; i++)
      ink += fragment(
        c,
        x + Math.cos(i * 2.4) * 52,
        y + Math.sin(i * 2.4) * 32,
        24,
        1.4,
        i,
        i + variant,
      );
  return ink;
}
function brokenRing(c: Colours, variant: number, sparse = false) {
  let ink = "";
  const count = sparse ? 9 : 25;
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count + variant * 0.19;
    if (!sparse && ((a > 0.4 && a < 1.15) || (a > 3.3 && a < 4.05))) continue;
    ink += fragment(
      c,
      512 + Math.cos(a) * 410,
      384 + Math.sin(a) * 245,
      sparse ? 17 : 38 + (i % 3) * 5,
      1.4,
      a,
      i + variant,
    );
  }
  return ink;
}
function slab(c: Colours, variant: number) {
  const shift = variant * 9;
  return (
    polygon(
      [
        [74, 320],
        [375, 210 + shift],
        [475, 333],
        [322, 390],
        [130, 392],
      ],
      c.body,
    ) +
    polygon(
      [
        [399, 210 + shift],
        [687, 200],
        [606, 354],
        [494, 330],
      ],
      c.lit,
    ) +
    polygon(
      [
        [708, 203],
        [964, 274],
        [875, 405],
        [626, 360],
      ],
      c.body,
    ) +
    polygon(
      [
        [133, 409],
        [322, 404],
        [472, 351],
        [431, 457],
        [235, 473],
      ],
      c.night,
    ) +
    polygon(
      [
        [502, 349],
        [606, 372],
        [864, 423],
        [650, 480],
        [454, 459],
      ],
      c.night,
    )
  );
}
function stream(c: Colours, variant: number) {
  let ink = "";
  for (let i = 0; i < 18; i++)
    ink += fragment(
      c,
      40 + i * 55,
      318 - i * 3 + Math.sin(i * 1.8 + variant) * 20,
      13 + (i % 3) * 4,
      1.6,
      -0.1,
      i,
    );
  return ink;
}
function hollow(c: Colours, variant: number) {
  const outer = around(512, 384, 280, 11),
    inner = around(504, 377, 150, 8).reverse();
  const points = (ps: readonly (readonly [number, number])[]) =>
    ps.map(([x, y]) => `${x} ${y}`).join(" L");
  return (
    path(`M${points(outer)} Z M${points(inner)} Z`, c.body).replace(
      "<path ",
      '<path fill-rule="evenodd" ',
    ) +
    polygon(
      [
        [245, 376],
        [329, 207],
        [495, 116],
        [485, 217],
        [361, 284],
      ],
      c.lit,
    ) +
    fragment(c, 808, 477, 81, 1.5, 0.3, variant)
  );
}
export function decorationSvg(c: Colours, galaxy: GalaxyId, variant: number): string {
  let ink = "";
  const v = variant;
  if (galaxy === "sunflower") {
    ink +=
      polygon(
        [
          [4, 50],
          [300, 80],
          [192, 286],
          [0, 242],
        ],
        c.night,
      ) +
      polygon(
        [
          [760, 522],
          [1024, 420],
          [1024, 752],
          [883, 714],
        ],
        c.body,
      );
    ink += rings(c, 512, 384, 470, 140, -18 + v * 9) + rings(c, 570, 365, 400, 205, 24 - v * 7);
    ink += planet(c, 512, 384, 335, "giant");
    ink +=
      rings(c, 512, 384, 470, 140, -18 + v * 9, true) +
      rings(c, 570, 365, 400, 205, 24 - v * 7, true);
    ink += planet(c, 112, 584, 31, "moon");
  } else if (galaxy === "whirlpool") {
    if (v === 1) ink += planet(c, 520, 385, 335, "giant");
    ink += spiral(c, v);
    if (v === 2) ink += fragment(c, 550, 350, 145, 1.3, 0.2, 11);
  } else if (galaxy === "needle") {
    if (v === 1) ink += planet(c, 510, 384, 335, "giant");
    else ink += slab(c, v);
    ink += `<g transform="translate(0 ${v === 0 ? 160 : -90})">${stream(c, v)}</g>`;
  } else if (galaxy === "andromeda") {
    ink += planet(c, 512 + v * 12, 384, 335, "giant", true);
    ink += planet(c, 108, 180, 36, "moon1") + planet(c, 903, 579, 44, "moon2");
  } else if (galaxy === "cartwheel") {
    if (v === 1) ink += planet(c, 512, 384, 335, "giant");
    if (v === 2) ink += hollow(c, v);
    else ink += brokenRing(c, v);
  } else {
    ink += planet(c, 512, 384, 335, "giant", false, true) + brokenRing(c, v, true);
    if (v === 2) ink += fragment(c, 890, 620, 155, 1.2, -0.3, 7);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">${ink}</svg>\n`;
}
