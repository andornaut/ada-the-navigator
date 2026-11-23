import { partsReach, worldParts } from "../../src/model/convex.ts";
import { DISPLAY_SCALE } from "./crafts.ts";
import { ENEMY_HEADINGS } from "./projection.ts";
import { hidden, type Model, projectedCollision, screen } from "./station-model.ts";

type Pair = readonly [number, number];
type Parts = readonly (readonly Pair[])[];
type LegacyMount = {
  id: string;
  anchor: Pair;
  pivot: Pair;
  collision: Record<string, Parts>;
};
export type LegacyLayout = {
  frame: number;
  headings: {
    index: number;
    collision: Parts;
    hardpoints: LegacyMount[];
    banner: Pair;
    order: string[];
  }[];
  tops: Record<string, { collision: Parts; muzzles: Pair[] }[]>;
};

const add = ([x, y]: Pair, [dx, dy]: Pair): Pair => [x + dx, y + dy];
const difference = ([x, y]: Pair, [dx, dy]: Pair): Pair => [x - dx, y - dy];
const rounded = (n: number) => Math.round(n * 1000) / 1000;
const round = ([x, y]: Pair): Pair => [rounded(x), rounded(y)];
const move = (parts: Parts, delta: Pair) =>
  parts.map((part) => part.map((p) => round(add(p, delta))));
const rectangle = ([x, y]: Pair, radius: number): Pair[] => [
  [x - radius, y - radius],
  [x + radius, y + radius],
];

/** Prepare existing v1 rows without introducing a new schema or changing the source asset identities. */
export function candidateLayout<T extends LegacyLayout>(
  model: Model,
  legacy: T,
  spriteRaw: { base: number; top: number },
) {
  const centred = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
    const source = legacy.headings[yaw]!;
    const collision = projectedCollision(model, yaw);
    const behind: string[] = [];
    const inFront: string[] = [];
    const hardpoints = model.anchors.map((placement) => {
      const old = source.hardpoints.find(({ id }) => id === placement.id)!;
      const anchor = round(screen(yaw, 1, placement.point));
      const delta = difference(anchor, old.anchor);
      const pivot = round(add(old.pivot, delta));
      (hidden(placement, model, yaw, 1) ? behind : inFront).push(placement.id);
      return {
        id: placement.id,
        anchor,
        pivot,
        collision: Object.fromEntries(
          Object.entries(old.collision).map(([state, parts]) => [state, move(parts, delta)]),
        ),
      };
    });
    const order = [
      ...source.order.filter((id) => behind.includes(id)),
      "hull",
      ...source.order.filter((id) => inFront.includes(id)),
    ];
    return {
      index: yaw,
      collision,
      hardpoints,
      order,
      banner: [
        0,
        (Math.min(...collision.flat().map(([, y]) => y)) +
          Math.max(...collision.flat().map(([, y]) => y))) /
          2,
      ] as const,
    };
  });
  const topPoints = Object.values(legacy.tops).flatMap((aims) =>
    aims.flatMap(({ collision, muzzles }) => [...collision.flat(), ...muzzles]),
  );
  const topExtent = Math.max(spriteRaw.top / 2, ...topPoints.flatMap((p) => p.map(Math.abs)));
  const assemblyPoints = centred.flatMap(({ collision, hardpoints }) => [
    ...collision.flat(),
    ...hardpoints.flatMap(({ anchor, pivot, collision: states }) => [
      ...rectangle(anchor, spriteRaw.base / 2),
      ...rectangle(pivot, topExtent),
      ...Object.values(states).flat(2),
      ...topPoints.map((point) => add(point, pivot)),
    ]),
  ]);
  const extent = assemblyPoints.reduce((max, [x, y]) => Math.max(max, Math.abs(x), Math.abs(y)), 0);
  const worldClearance = partsReach(
    worldParts([assemblyPoints.map(([x, y]) => ({ x: x * DISPLAY_SCALE, y: y * DISPLAY_SCALE }))]),
  );
  const frame = Math.ceil((2 * extent + 16) / 8) * 8;
  const centre: Pair = [frame / 2, frame / 2];
  const headings = centred.map(({ collision, banner, hardpoints, ...heading }) => ({
    ...heading,
    collision: move(collision, centre),
    banner: round(add(banner, centre)),
    hardpoints: hardpoints.map(({ anchor, pivot, collision: states, id }) => ({
      id,
      anchor: round(add(anchor, centre)),
      pivot: round(add(pivot, centre)),
      collision: Object.fromEntries(
        Object.entries(states).map(([state, parts]) => [state, move(parts, centre)]),
      ),
    })),
  }));
  const columns = Math.min(4, Math.floor(1728 / frame));
  return {
    layout: { ...legacy, frame, headings },
    clearance: {
      rawAssemblyFrame: frame,
      intrinsic: frame * DISPLAY_SCALE,
      maxAbsoluteRawExtent: extent,
      smallestMarginRaw: frame / 2 - extent,
      conservativeLogicalCullRadius: (Math.SQRT2 * frame * DISPLAY_SCALE) / 2,
      proposedWorldClearanceReach: worldClearance,
      columns,
      pageEdge: columns * frame,
      pages: columns ? Math.ceil(ENEMY_HEADINGS / columns ** 2) : null,
    },
  };
}
