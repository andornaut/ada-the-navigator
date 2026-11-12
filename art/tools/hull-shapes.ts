// Rounded and composite hull shapes for the story craft models. Plans are in (u forward, v across)
// with local forward -y, as for every craft. Parts are vertical extrusions (solid.ts), so a round
// section is a stack of layers: a horizontal cylinder is three layers, a ball five tiers.
import { along, box, ngon, orientedBox, orientedPlan, type Part, type Plan } from "./solid.ts";

export const FWD = -Math.PI / 2;
export const uv = (u: number, v: number) => along(FWD, u, v);
export const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
export const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);

export function part(
  plan: Plan,
  z0: number,
  z1: number,
  top: string,
  side: string,
  rear?: string,
): Part {
  return rear === undefined ? { plan, z0, z1, top, side } : { plan, z0, z1, top, side, rear };
}

// A cube of side `size` at (u, v) from z0: lamps, headlights and tufts.
export function cube(u: number, v: number, z0: number, size: number, color: string): Part {
  const [x, y] = uv(u, v);
  const h = size / 2;
  return { plan: box(x - h, y - h, x + h, y + h), z0, z1: z0 + size, top: color, side: color };
}

export function disc(
  u: number,
  v: number,
  r: number,
  z0: number,
  z1: number,
  top: string,
  side: string,
  n = 12,
): Part {
  const [x, y] = uv(u, v);
  return { plan: ngon(n, r, x, y, Math.PI / n), z0, z1, top, side };
}

// A ball of radius r centred at height zc: five stacked tiers, the top one in `cap`.
export function ball(
  u: number,
  v: number,
  zc: number,
  r: number,
  top: string,
  side: string,
  cap = top,
  n = 12,
): Part[] {
  const tiers = [
    [0.62, -1, -0.72],
    [0.92, -0.72, -0.3],
    [1, -0.3, 0.3],
    [0.92, 0.3, 0.72],
    [0.62, 0.72, 1],
  ] as const;
  return tiers.map(([k, a, b], i) =>
    disc(u, v, r * k, zc + a * r, zc + b * r, i === tiers.length - 1 ? cap : top, side, n),
  );
}

export type End = "round" | "point" | "flat" | "blunt";

// A plan pill along u from u0 to u1, half-width w, centred on v.
export function pill(
  u0: number,
  u1: number,
  v: number,
  w: number,
  front: End = "round",
  back: End = "round",
): Plan {
  const reach = Math.min(2.2 * w, (u1 - u0) * 0.9);
  const arc = (uc: number, from: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = from + (i / 6) * Math.PI;
      return [uc + w * Math.cos(t), v + w * Math.sin(t)] as const;
    });
  const ends: Record<End, (readonly [number, number])[]> = {
    round: arc(u1 - w, -Math.PI / 2),
    point: [
      [u1 - reach, v - w],
      [u1, v],
      [u1 - reach, v + w],
    ],
    flat: [
      [u1, v - w],
      [u1, v + w],
    ],
    blunt: [
      [u1 - 0.45 * w, v - w],
      [u1, v - 0.45 * w],
      [u1, v + 0.45 * w],
      [u1 - 0.45 * w, v + w],
    ],
  };
  const backs: Record<End, (readonly [number, number])[]> = {
    round: arc(u0 + w, Math.PI / 2),
    point: [
      [u0 + reach, v + w],
      [u0, v],
      [u0 + reach, v - w],
    ],
    flat: [
      [u0, v + w],
      [u0, v - w],
    ],
    blunt: [
      [u0 + 0.45 * w, v + w],
      [u0, v + 0.45 * w],
      [u0, v - 0.45 * w],
      [u0 + 0.45 * w, v - w],
    ],
  };
  return craftPlan([...ends[front], ...backs[back]]);
}

export type Cylinder = {
  top: string;
  side: string;
  rear?: string;
  cap?: string;
  front?: End;
  back?: End;
};

// A horizontal cylinder along u at height zc, radius r: a narrow, a full and a narrow layer.
export function hcyl(u0: number, u1: number, v: number, zc: number, r: number, c: Cylinder) {
  const layers = [
    [0.7, -1, -0.7],
    [1, -0.7, 0.7],
    [0.7, 0.7, 1],
  ] as const;
  return layers.map(([k, a, b], i): Part => {
    const shrink = (1 - k) * r;
    const plan = pill(u0 + shrink, u1 - shrink, v, r * k, c.front, c.back);
    const top = i === layers.length - 1 ? (c.cap ?? c.top) : c.top;
    return part(plan, zc + a * r, zc + b * r, top, c.side, c.rear);
  });
}

// An annulus round (u, v) in n segments, each its own group so segments sort far to near.
export function ring(
  u: number,
  v: number,
  outer: number,
  inner: number,
  z0: number,
  z1: number,
  n: number,
  color: (i: number) => readonly [string, string],
): Part[][] {
  const at = (r: number, a: number) => [u + r * Math.cos(a), v + r * Math.sin(a)] as const;
  return Array.from({ length: n }, (_, i) => {
    const [a0, a1] = [(i / n) * 2 * Math.PI, ((i + 1) / n) * 2 * Math.PI];
    const [top, side] = color(i);
    return [
      part(
        craftPlan([at(outer, a0), at(outer, a1), at(inner, a1), at(inner, a0)]),
        z0,
        z1,
        top,
        side,
      ),
    ];
  });
}

// Every part scaled by k about the pivot.
export function scaleGroups(k: number, groups: readonly Part[][]): Part[][] {
  return groups.map((group) =>
    group.map((p) => ({
      ...p,
      plan: p.plan.map(([x, y]) => [x * k, y * k] as const),
      z0: p.z0 * k,
      z1: p.z1 * k,
    })),
  );
}
