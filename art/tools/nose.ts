// Story craft nose data, shared by every craft with a `nose` in its jets file (Cartwheel's story
// craft rule, art/cartwheel.md): the drawn tip per heading and the world distance from the pivot
// to the point under it. Craft plans are written in (u forward, v across) with forward -y.
import { anchor, ENEMY_HEADINGS, type Point, projectAt, rotate, round } from "./projection.ts";
import { along, DISPLAY_SCALE, type Face } from "./solid.ts";

const uv = (u: number, v: number) => along(-Math.PI / 2, u, v);

type Plan = readonly (readonly [number, number])[];
export type NoseCraft = {
  name: string;
  // The craft's part groups; with every wall hidden, so window panes are left out.
  build: (
    visible: (nx: number, ny: number) => boolean,
  ) => readonly (readonly { plan: Plan; z1: number }[])[];
};

// The nose tip: the midpoint of the forward-most top edge of the craft's solid parts, nearest the
// centre line (ties to negative v). Window panes stand 0.6 proud of their walls only so they render.
function noseTip(craft: NoseCraft): { reach: number; tip: Point } {
  const parts = craft.build(() => false).flat();
  const reach = Math.max(...parts.flatMap(({ plan }) => plan.map(([, y]) => -y)));
  const edges = parts.flatMap(({ plan, z1 }) => {
    const front = plan.filter(([, y]) => Math.abs(y + reach) < 1e-9).map(([x]) => x);
    return front.length === 0 ? [] : [{ v: (Math.min(...front) + Math.max(...front)) / 2, z: z1 }];
  });
  const { v, z } = edges.sort(
    (p, q) => Math.abs(p.v) - Math.abs(q.v) || p.v - q.v || q.z - p.z,
  )[0]!;
  return { reach, tip: [...uv(reach, v), z] };
}

// World units from the pivot to the point under the nose tip on the centre line at heading `yaw`:
// the art's projection at display scale through the inverse of the game's (x - y, (x + y) / 2).
function noseDistance(reach: number, yaw: number): number {
  const [x, y] = projectAt(0, 0, rotate(ENEMY_HEADINGS, yaw, [...uv(reach, 0), 0]));
  const [sx, sy] = [x * DISPLAY_SCALE, y * DISPLAY_SCALE];
  return round(Math.hypot(sy + sx / 2, sy - sx / 2));
}

type Point2 = readonly [number, number];
const segmentDistance = ([px, py]: Point2, [ax, ay]: Point2, [bx, by]: Point2) => {
  const [ex, ey] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ax - t * ex, py - ay - t * ey);
};

/**
 * Per heading, the drawn tip in frame px and the nose distance in world units, for a craft drawn
 * in a square `frame` with `facesAt(yaw)` its heading's faces. Fails unless each tip lies within
 * 0.5 frame px of an edge of a face that heading draws.
 */
export function noses(facesAt: (yaw: number) => readonly Face[], frame: number, craft: NoseCraft) {
  const centre = frame / 2;
  const { reach, tip } = noseTip(craft);
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
    const point = anchor(ENEMY_HEADINGS, centre, yaw, tip);
    const gap = Math.min(
      ...facesAt(yaw).flatMap(({ points }) => {
        const drawn = points.map((p) => projectAt(centre, centre, p));
        return drawn.map((p, i) => segmentDistance(point, p, drawn[(i + 1) % drawn.length]!));
      }),
    );
    if (gap > 0.5) {
      throw new Error(`${craft.name}-${yaw} nose is ${gap.toFixed(2)} frame px off the hull`);
    }
    return { distance: noseDistance(reach, yaw), tip: point };
  });
}
