import { anchor, json, type Point, projectAt, rotate, SHIP_HEADINGS } from "./projection.ts";
import { DISPLAY, drawnParts, FRAME, forwardJetMouthGeometry, shipVertices } from "./ship-model.ts";

type XY = readonly [number, number];
type Mouth = {
  anchor: XY;
  half: XY;
  capCenter?: XY;
};
type Heading = {
  index: number;
  mouths: readonly [Mouth, Mouth];
  farMouth?: 0 | 1;
  tailEdge?: readonly [XY, XY];
};

const MID = FRAME / 2;
const FRAME_PER_DISPLAY = FRAME / DISPLAY;
const EDGE_EPSILON = 0.0001;
const blend = (from: number, to: number, amount: number) => from + (to - from) * amount;
const dot = ([x, y]: XY, [dx, dy]: XY) => x * dx + y * dy;
const minus = ([x, y]: XY, [a, b]: XY): XY => [x - a, y - b];
const point = ([x, y]: XY, [dx, dy]: XY, amount: number): XY => [x + dx * amount, y + dy * amount];
const coordinates = (a: XY, b: XY, along: number, across: number): XY => [
  a[0] * along + b[0] * across,
  a[1] * along + b[1] * across,
];

function sectionsAt(outlines: readonly (readonly XY[])[], along: XY, across: XY, cross: number) {
  const ranges: [number, number][] = [];
  for (const outline of outlines) {
    let front = Infinity;
    let rear = -Infinity;
    let previous = outline.at(-1)!;
    for (const next of outline) {
      const from = dot(previous, across);
      const to = dot(next, across);
      if (from <= cross !== to <= cross) {
        const at = blend(dot(previous, along), dot(next, along), (cross - from) / (to - from));
        front = Math.min(front, at);
        rear = Math.max(rear, at);
      }
      previous = next;
    }
    if (front < rear) ranges.push([front, rear]);
  }
  return ranges;
}

function nearestSection(ranges: [number, number][], root: number) {
  const merged: [number, number][] = [];
  for (const [front, rear] of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && front <= last[1] + EDGE_EPSILON) {
      last[1] = Math.max(last[1], rear);
    } else {
      merged.push([front, rear]);
    }
  }
  // An oblique ray can also cross the far wing. Contact belongs to the section nearest the root.
  let nearest = Infinity;
  let contact: XY | undefined;
  for (const range of merged) {
    const [front, rear] = range;
    const gap = Math.max(front - root, root - rear, 0);
    if (gap < nearest) {
      contact = range;
      nearest = gap;
    }
  }
  return contact;
}

/** Only publish the named edge where an actual visible tail fragment exposes it at the rear. */
function exposesTailEdge(
  edge: readonly [XY, XY],
  fragments: ReturnType<typeof drawnParts>,
  outlines: readonly (readonly XY[])[],
  along: XY,
  across: XY,
): boolean {
  const [apex, tail] = edge;
  const direction = minus(tail, apex);
  const length = Math.hypot(...direction);
  if (length <= EDGE_EPSILON) return false;
  const unit: XY = [direction[0] / length, direction[1] / length];
  const normal: XY = [-unit[1], unit[0]];
  for (const { slot, outline } of fragments) {
    if (slot !== "tailLeft" && slot !== "tailRight") continue;
    let previous = outline.at(-1)!;
    for (const next of outline) {
      const a = minus(previous, apex);
      const b = minus(next, apex);
      previous = next;
      if (Math.abs(dot(a, normal)) > EDGE_EPSILON || Math.abs(dot(b, normal)) > EDGE_EPSILON)
        continue;
      const start = Math.max(0, Math.min(dot(a, unit), dot(b, unit)));
      const end = Math.min(length, Math.max(dot(a, unit), dot(b, unit)));
      if (end - start <= EDGE_EPSILON) continue;
      const probe = point(apex, unit, (start + end) / 2);
      const sections = sectionsAt(outlines, along, across, dot(probe, across));
      const rear = Math.max(...sections.map(([, boundary]) => boundary));
      if (Math.abs(rear - dot(probe, along)) <= EDGE_EPSILON) return true;
    }
  }
  return false;
}

function flightHeading(index: number): Heading {
  const pose = { yaw: index };
  const [port, starboard] = forwardJetMouthGeometry(MID, pose);
  const axisLength = Math.hypot(...port!.axis);
  const along: XY = [port!.axis[0] / axisLength, port!.axis[1] / axisLength];
  const across: XY = [-along[1], along[0]];
  const lateral = Math.abs(along[0]);
  const facing = lateral ** 2;
  const t = Math.max(0, Math.min(1, (lateral - 0.55) / 0.45));
  const profile = t * t * (3 - 2 * t);
  const halfWidth = blend(5.45, 4.3, facing);
  const rootX = blend(13.6, 15.65, facing);
  const rootY = blend(20.5, 20.2, facing);
  const [vx, vy] = rotate(SHIP_HEADINGS, index, [-1, 0, 0]);
  const farMouth = vx + vy < 0 ? 0 : 1;
  const fragments = profile ? drawnParts(MID, pose) : [];
  const outlines = fragments.map(({ outline }) => outline);

  function flightMouth(mouth: typeof port, side: -1 | 1, mouthIndex: 0 | 1): Mouth {
    const root: Point = [side * rootX, rootY, 1];
    const localInset = mouthIndex === farMouth ? 2.2 : 0.6;
    const insetRoot: Point = [side * (rootX - localInset), rootY, 1];
    const from = anchor(SHIP_HEADINGS, MID, index, root);
    const to = anchor(SHIP_HEADINGS, MID, index, insetRoot);
    const centre: XY = [blend(from[0], to[0], profile), blend(from[1], to[1], profile)];
    const body = point(centre, along, 0.6 * FRAME_PER_DISPLAY * profile);
    const half: XY = [mouth!.half[0] * halfWidth, mouth!.half[1] * halfWidth];
    const cross = dot(centre, across);
    const depth = dot(body, along);
    const section = nearestSection(sectionsAt(outlines, along, across, cross), depth);
    if (!section) return { anchor: body, half };
    const [front, rear] = section;
    // Where another hull face eclipses the root, retain contact near the body instead of
    // jumping to that face's far edge. A tucked root can disappear behind a wing.
    const tuck = 0.32 * FRAME_PER_DISPLAY;
    const contact = Math.max(
      front + Math.min(tuck, (rear - front) / 2),
      Math.min(rear, depth) - tuck,
    );
    return { anchor: body, half, capCenter: coordinates(along, across, contact, cross) };
  }

  const mouths = [flightMouth(port, -1, 0), flightMouth(starboard, 1, 1)] as const;
  if (!mouths[0].capCenter || !mouths[1].capCenter) return { index, mouths };

  const { apex, tail } = shipVertices();
  const project = (vertex: Point) => projectAt(MID, MID, rotate(SHIP_HEADINGS, index, vertex));
  const edge = [project(apex), project(tail)] as const;
  return {
    index,
    mouths,
    farMouth,
    ...(exposesTailEdge(edge, fragments, outlines, along, across) ? { tailEdge: edge } : {}),
  };
}

/** Flight-only B placement. Legacy mouth centres serve the static and aboard consumers. */
export function forwardFlightJson(): string {
  return json({
    version: 1,
    frame: FRAME,
    headings: Array.from({ length: SHIP_HEADINGS }, (_, index) => flightHeading(index)),
  });
}
