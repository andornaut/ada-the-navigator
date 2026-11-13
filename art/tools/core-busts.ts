import { readFileSync } from "node:fs";
import { decodePng } from "@andornaut/art-kit/png";
// Admiral Archie and Grandma bust frames. The legacy gadget export and asset keys retain the
// ten-frame reveal contract. The unknown officer is the same dog bust without facial details.
import type { Frame } from "@andornaut/art-kit/grid";

import {
  above,
  blank,
  crop,
  dots,
  ellipse,
  faceNeutral,
  fill,
  fuzz,
  INK,
  line,
  minus,
  paint,
  type Point,
  polygon,
  rect,
  shoulders,
  stamp,
  union,
  WHITE,
  without,
} from "./bust.ts";

const AMBER = "f0bd68";
const AMBER_SIDE = "b98a40";
const SILHOUETTE = { base: "100e1a", rim: "6b7aa0", rimDark: "68386c" };
const STATIC_LIGHT = "3a4466";
const STATIC_DARK = "1d2032";

// The approved head-and-shoulder drawing is the neutral source for every named frame.
const source = decodePng(
  readFileSync(new URL("../sources/admiral-archie-neutral.png", import.meta.url)),
);
const neutral: Frame = Array.from({ length: 32 }, (_, y) =>
  Array.from({ length: 32 }, (_, x) => {
    const i = (y * source.width + x) * 4;
    return source.data[i + 3]
      ? [...source.data.subarray(i, i + 3)].map((c) => c.toString(16).padStart(2, "0")).join("")
      : null;
  }),
);
const BUST = neutral.map((row) => row.map((c) => c !== null));
const CROWN = union(above(ellipse(15.5, 5.4, 8.2, 4.6), 9), rect(9, 7, 22, 9));
const VISOR = ellipse(15.5, 10, 7.6, 1.6);
type Mouth = "closed" | "half" | "open";

function dog(mouth: Mouth | null): Frame {
  const frame = neutral.map((row) => [...row]);
  if (mouth === "open" || mouth === "half") {
    fill(frame, ellipse(15.5, 21, mouth === "open" ? 2.2 : 1.6, mouth === "open" ? 1.7 : 0.8), INK);
    if (mouth === "open")
      dots(
        frame,
        [
          [15, 22],
          [16, 22],
        ],
        "f6757a",
      );
  }
  return frame;
}

// Deterministic static (mulberry32).
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The unnamed voice: static and a rolling scanline behind the faceless bust, two glitch bands
// tearing it sideways, and the cap's outline intact on top. `step` 0 to 3 varies the static.
function silhouette(step: number): Frame {
  const frame = blank();
  const next = random(77 + step * 31);
  for (const [y, row] of frame.entries()) {
    for (const x of row.keys()) {
      const v = next();
      row[x] = v < 0.06 ? STATIC_LIGHT : v < 0.13 ? STATIC_DARK : null;
    }
    if ((y + step) % 4 === 0) {
      for (const x of row.keys()) {
        if (next() < 0.5) row[x] = STATIC_DARK;
      }
    }
  }
  paint(frame, BUST, SILHOUETTE);
  const snapshot = frame.map((row) => [...row]);
  for (const [band, shift] of [
    [((6 + step * 5) % 20) + 4, 2],
    [((15 + step * 7) % 20) + 6, -3],
  ] as const) {
    for (let y = band; y < Math.min(band + 2, 31); y++) {
      for (const x of frame[y]!.keys()) frame[y]![x] = snapshot[y]![x - shift] ?? null;
    }
  }
  paint(frame, union(CROWN, VISOR), SILHOUETTE);
  return frame;
}

const WAVES = [
  [0, 2, -2, 1, -1, 2, -2, 0, 2, -1, 2, -2, 1, -1, 0, 0],
  [0, -1, 2, -2, 2, -2, 1, -1, 2, 0, -2, 2, -2, 1, 0, 0],
];

// The amber voice trace on `row` from x0 to x1: flat and dim when idle, a hard zigzag speaking.
function trace(frame: Frame, row: number, x0: number, x1: number, step: number | null): void {
  if (step === null) {
    dots(frame, line([x0, row], [x1, row]), AMBER_SIDE);
    return;
  }
  const points = WAVES[step % 2]!.map((a, i): Point => [x0 + 2 * i, row - a]).filter(
    ([x]) => x <= x1,
  );
  for (let i = 1; i < points.length; i++) dots(frame, line(points[i - 1]!, points[i]!), AMBER);
}

/** The officer's compact window in the 32 frame: the ear tips to the collar. */
export const GADGET_CROP: Point = [5, 1];
const MOUTHS: readonly Mouth[] = ["open", "half", "open", "closed"];

/** An officer frame: unnamed or named, idle (`step` null) or speaking frame `step` 0 to 3. */
export function gadget(named: boolean, step: number | null, compact: boolean): Frame {
  if (named) {
    const frame = dog(step === null ? null : MOUTHS[step]!);
    return compact ? crop(frame, GADGET_CROP) : frame;
  }
  const frame = silhouette(step ?? 0);
  if (compact) {
    const small = crop(frame, GADGET_CROP);
    trace(small, 20, 1, 20, step);
    return small;
  }
  trace(frame, 28, 3, 28, step);
  return frame;
}

/** Grandma's compact window in the 32 frame: the bun's flower to the chin. */
export const GRANDMA_CROP: Point = [5, 2];

export function grandma(): Frame {
  const frame = blank();
  paint(frame, shoulders([7, 9, 11, 12, 12, 12, 12]), {
    base: "b55088",
    light: "f6757a",
    shade: "68386c",
  });
  paint(
    frame,
    polygon([
      [11.5, 24.5],
      [15.5, 28.5],
      [19.5, 24.5],
    ]),
    { base: "ead4aa", outline: false, shade: "c28569" },
  );
  // Garden apron straps and bib.
  paint(frame, union(rect(8, 25, 10, 31), rect(21, 25, 23, 31), rect(10, 29, 21, 31)), {
    base: "63c74d",
    shade: "3e8948",
  });
  dots(
    frame,
    [
      [13, 30],
      [14, 30],
    ],
    "c0cbdc",
  );
  paint(frame, rect(13, 21, 18, 25), { base: "b86f50", shade: "733e39" });
  // Curly grey hair behind, the face, the hair over it and the bun.
  paint(frame, fuzz(ellipse(15.5, 12, 10.8, 7.6), 2, 1), { base: "c0cbdc", shade: "8b9bb4" });
  paint(frame, ellipse(15.5, 15.4, 9.4, 9), { base: "b86f50", shade: "733e39" });
  const hair = above(
    minus(
      fuzz(ellipse(15.5, 9.4, 10.4, 5.6), 3, 0),
      ellipse(17.5, 13.6, 8.2, 3.6),
      ellipse(9.5, 14, 2.6, 2.4),
    ),
    15,
  );
  paint(frame, hair, { base: "c0cbdc", light: WHITE, shade: "8b9bb4" });
  dots(
    frame,
    [
      [9, 8],
      [10, 7],
      [13, 7],
      [14, 6],
      [19, 7],
      [20, 8],
      [22, 9],
      [11, 10],
    ],
    "8b9bb4",
  );
  paint(frame, fuzz(ellipse(15.5, 3.9, 4.8, 3.3), 3, 1), {
    base: "c0cbdc",
    light: WHITE,
    shade: "8b9bb4",
  });
  dots(
    frame,
    [
      [14, 3],
      [15, 2],
      [17, 4],
    ],
    "8b9bb4",
  );
  // A flower and a leaf tucked in the bun.
  stamp(frame, 19, 1, [".p.", "pyp", ".pg", "..g"], { g: "63c74d", p: "f6757a", y: "fee761" });
  faceNeutral(frame, { ex: 10, ey: 15, gap: 9, mouth: "3e2731", my: 21 });
  // Round gold glasses.
  for (const gx of [9, 18]) {
    const ring = without(minus(rect(gx, 14, gx + 4, 18), rect(gx + 1, 15, gx + 3, 17)), [
      [gx, 14],
      [gx + 4, 14],
      [gx, 18],
      [gx + 4, 18],
    ]);
    fill(frame, ring, "feae34");
  }
  dots(
    frame,
    [
      [14, 16],
      [15, 15],
      [16, 15],
      [17, 16],
    ],
    "feae34",
  );
  return frame;
}
