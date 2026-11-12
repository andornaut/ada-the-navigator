// Black Eye's solid models in the station family's projection (solid.ts): the three Blurb
// settlements, each with its dock cracked by the blockades or mended. Contract: art/black-eye.md.
import {
  approachLights,
  blueDim,
  cream,
  creamSide,
  DOCK,
  dockCollar,
  mouth,
  ngon,
  orientedBox,
  type Part,
  type Plan,
  along,
  warm,
} from "./solid.ts";

// ---------------------------------------------------------------- palette

// Lilac goo, lighter than the field in its own hue, on a darker set-goo float.
export const blurb = {
  goo: "#d4b8ee",
  gooSide: "#a283c2",
  gloss: "#f4eafc",
  deck: "#8a6fa8",
  deckSide: "#614b7e",
  deckInset: "#9c82ba",
  lamp: warm,
  lampDim: "#8a7a5c",
} as const;
const b = blurb;

export type DockState = "cracked" | "mended";

// Deck height that buildings rest on: a group based at or above it draws after the float.
export const DECK = 5.6;
export const SETTLEMENT_LEVELS = [DECK] as const;
// Every settlement's decorative dock: mouth width and face distance on the dock axis.
export const SETTLEMENT_DOCK = { face: 36, mouth: 18, collar: 26, height: 10 } as const;

const degrees = (d: number) => (d * Math.PI) / 180;
const polar = (angle: number, r: number) => [Math.cos(angle) * r, Math.sin(angle) * r] as const;

// A goo dome: five tiers on a dome profile, each nudged by `lean` for a wobble, a gloss spot on
// the top tier toward the light at the upper left of the screen, and warm windows on the front
// of the lowest tier.
function dome(
  cx: number,
  cy: number,
  r: number,
  z0: number,
  h: number,
  lean: number,
  windows: number,
): Part[] {
  const steps = 5;
  const radius = (i: number) => r * Math.sqrt(1 - (i / steps) ** 2 * 0.97);
  const centre = (i: number) => [cx + lean * i * 0.8, cy - lean * i * 0.5] as const;
  const parts: Part[] = Array.from({ length: steps }, (_, i) => ({
    plan: ngon(12, radius(i), ...centre(i), Math.PI / 12),
    z0: z0 + (h * i) / steps,
    z1: z0 + (h * (i + 1)) / steps,
    top: b.goo,
    side: b.gooSide,
  }));
  const top = radius(steps - 1);
  const [gx, gy] = centre(steps - 1);
  parts.push({
    plan: ngon(8, top * 0.42, gx - top * 0.32, gy, Math.PI / 8),
    z0: z0 + h,
    z1: z0 + h + 0.3,
    top: b.gloss,
    side: b.goo,
  });
  for (let w = 0; w < windows; w++) {
    const angle = degrees(45 + (w - (windows - 1) / 2) * 34);
    const [wx, wy] = polar(angle, r * 0.98);
    parts.splice(1 + w, 0, {
      plan: orientedBox(cx + wx, cy + wy, angle + Math.PI / 2, r * 0.32, 0.6),
      z0: z0 + h * 0.07,
      z1: z0 + h * 0.07 + Math.min(3.2, r * 0.32),
      top: warm,
      side: warm,
    });
  }
  return parts;
}

// A set-goo float with a lighter inset top.
function float(plan: Plan, inset: Plan): Part[] {
  return [
    { plan, z0: 0, z1: DECK - 0.6, top: b.deck, side: b.deckSide },
    { plan: inset, z0: DECK - 0.6, z1: DECK, top: b.deckInset, side: b.deckSide },
  ];
}

// A goo stalk rising to a lamp bulb.
function stalk(x: number, y: number, height: number, bulb: number, lit: boolean): Part[] {
  const lamp = lit ? b.lamp : b.lampDim;
  return [
    { plan: ngon(6, 1.3, x, y), z0: DECK, z1: DECK + height, top: b.goo, side: b.gooSide },
    {
      plan: ngon(8, bulb, x, y, Math.PI / 8),
      z0: DECK + height,
      z1: DECK + height + bulb * 1.6,
      top: lamp,
      side: lamp,
    },
  ];
}

// ---------------------------------------------------------------- dock

// The crack the blockades left, as stepped panes 0.3 proud of the collar's face, across the band
// above the mouth from the broken corner on the screen-right side: [across, width, z0, z1] with
// z from the mouth's top.
const CRACK = [
  [-11.6, 1.4, 2.8, 4],
  [-9.9, 2, 1.9, 3.2],
  [-7.8, 2.2, 1, 2.3],
  [-5.6, 2.2, 0, 1.4],
] as const;

// The family dock collar. Cracked: its top corner on the crack side broken off, the crack dark,
// the floor strip split and that corner light out. Mended: whole, the crack filled with goo.
export function blurbDock(lit: boolean, state: DockState): Part[] {
  const { collar, face, height, mouth: mouthWidth } = SETTLEMENT_DOCK;
  const p = (distance: number, across: number) => along(DOCK, distance, across);
  const parts = dockCollar(lit, face, mouthWidth, collar, cream, creamSide, height);
  const crack = CRACK.map(([across, width, z0, z1]): Part => ({
    plan: orientedBox(...p(face + 0.3, across), DOCK, 0.6, width),
    z0: height + z0,
    z1: height + z1,
    top: state === "cracked" ? mouth : b.goo,
    side: state === "cracked" ? mouth : b.goo,
  }));
  if (state === "mended") {
    return [parts[0]!, ...crack, ...parts.slice(1), ...approachLights(lit, face)];
  }
  // The collar without its broken corner: the full-height span, and the corner stub below the
  // break.
  const edge = -collar / 2;
  const breakAt = -mouthWidth / 2 + 0.5;
  const whole = (from: number, to: number, z1: number): Part => ({
    plan: orientedBox(...p(face - 4, (from + to) / 2), DOCK, 8, to - from),
    z0: -3,
    z1,
    top: cream,
    side: creamSide,
  });
  const floor = parts[3]!;
  const strip = (from: number, to: number): Part => ({
    ...floor,
    plan: orientedBox(...p(face + 0.9, (from + to) / 2), DOCK, 0.6, to - from),
  });
  const reach = (mouthWidth * 0.77) / 2;
  return [
    whole(breakAt, -edge, height + 4),
    whole(edge, breakAt, height + 1.2),
    ...crack,
    parts[1]!,
    parts[2]!,
    strip(-reach, -2.4),
    strip(-0.8, reach),
    parts[4]!,
    { ...parts[5]!, top: blueDim, side: blueDim },
    parts[6]!,
    parts[7]!,
    ...approachLights(lit, face),
  ];
}

// ---------------------------------------------------------------- settlements

// First settlement, the homes: five goo domes of mixed sizes on a round float and a lamp stalk.
export function homes(lit: boolean, state: DockState): Part[][] {
  const groups: Part[][] = [
    float(ngon(14, 31, 0, 0, Math.PI / 14), ngon(14, 28, 0, 0, Math.PI / 14)),
  ];
  for (const [angle, distance, r, h, lean, windows] of [
    [205, 14, 10, 13, 0.6, 2],
    [262, 17, 7.5, 9, -0.5, 1],
    [318, 15, 9, 11, 0.4, 1],
    [150, 18, 7, 8, -0.4, 1],
    [10, 18, 6.5, 7, 0.5, 1],
  ] as const) {
    const [x, y] = polar(degrees(angle), distance);
    groups.push(dome(x, y, r, DECK, h, lean, windows));
  }
  groups.push(stalk(...polar(degrees(95), 22), 16, 2.2, lit));
  groups.push(blurbDock(lit, state));
  return groups;
}

// Second settlement, the travellers' harbour: a long float with a three-dome hall and a cream
// berth with a lamp pylon at each end.
export function harbour(lit: boolean, state: DockState): Part[][] {
  const axis = degrees(-45);
  const turn = (u: number, v: number) =>
    [u * Math.cos(axis) - v * Math.sin(axis), u * Math.sin(axis) + v * Math.cos(axis)] as const;
  const oval = (rx: number, ry: number): Plan =>
    Array.from({ length: 18 }, (_, i) => {
      const t = (2 * Math.PI * i) / 18;
      return turn(Math.cos(t) * rx, Math.sin(t) * ry);
    });
  const groups: Part[][] = [float(oval(40, 24), oval(37, 21))];
  for (const [d, r, h, windows] of [
    [-14, 8.5, 10, 1],
    [0, 10.5, 14, 2],
    [14, 8.5, 10, 1],
  ] as const) {
    groups.push(dome(...turn(d, -4), r, DECK, h, 0, windows));
  }
  for (const end of [-1, 1]) {
    const [x, y] = turn(end * 33, 2);
    groups.push([
      {
        plan: orientedBox(x, y, axis, 10, 6),
        z0: DECK - 2,
        z1: DECK + 1.5,
        top: cream,
        side: creamSide,
      },
      ...stalk(x, y, 12, 1.8, lit),
    ]);
  }
  groups.push(blurbDock(lit, state));
  return groups;
}

// Third settlement, Dollop's signal: a tall wobbly goo spire under a signal lamp, two small domes.
export function signal(lit: boolean, state: DockState): Part[][] {
  const groups: Part[][] = [
    float(ngon(12, 28, 0, 0, Math.PI / 12), ngon(12, 25, 0, 0, Math.PI / 12)),
  ];
  const [cx, cy] = polar(degrees(225), 4);
  const spire: Part[] = [];
  let z = DECK;
  const tiers = [
    [10, 7],
    [8, 6],
    [6.5, 6],
    [5, 5],
    [4, 5],
    [3, 4],
  ] as const;
  tiers.forEach(([r, h], i) => {
    const wobble = (i % 2 === 0 ? 1 : -1) * 1.2;
    spire.push({
      plan: ngon(10, r, cx + wobble, cy - wobble, Math.PI / 10),
      z0: z,
      z1: z + h,
      top: i === tiers.length - 1 ? b.gloss : b.goo,
      side: b.gooSide,
    });
    if (i === 1) {
      spire.push({
        plan: orientedBox(cx + wobble + 5.6, cy - wobble + 5.6, degrees(135), 3, 0.6),
        z0: z + 1.5,
        z1: z + 4.5,
        top: warm,
        side: warm,
      });
    }
    z += h;
  });
  const lamp = lit ? b.lamp : b.lampDim;
  spire.push({ plan: ngon(8, 3.4, cx, cy, Math.PI / 8), z0: z, z1: z + 5, top: lamp, side: lamp });
  spire.push({
    plan: ngon(8, 2.2, cx, cy, Math.PI / 8),
    z0: z + 5,
    z1: z + 6,
    top: lit ? "#ffffff" : lamp,
    side: lamp,
  });
  groups.push(spire);
  for (const [angle, distance, r, h] of [
    [140, 17, 6.5, 8],
    [320, 17, 7, 9],
  ] as const) {
    groups.push(dome(...polar(degrees(angle), distance), r, DECK, h, 0.4, 1));
  }
  groups.push(blurbDock(lit, state));
  return groups;
}
