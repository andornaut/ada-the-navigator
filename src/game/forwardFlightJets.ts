import { SHIP_HEADINGS } from "../model/shipHeadingContract.ts";
import type { Vec } from "../model/types.ts";
import { jetShapePolygons, layerAlpha } from "./jetGeometry.ts";
import { type JetDisplay, jetLength, layerColor, type ShipJets } from "./shipJets.ts";

export const FORWARD_FLIGHT_PATH = "/art/ship-forward-flight.json";
export const FORWARD_FLIGHT_KEY = "ship-forward-flight";
const FRAME = 96;
const CAP_CURVE = (0.78 * FRAME) / 42;
const CAP_CLEARANCE = (0.06 * FRAME) / 42;
const END_ON_EXTRA = 0.26;
const FIXED_ROOT = 0.1;

type MouthIndex = 0 | 1;
interface ForwardMouth {
  readonly anchor: Vec;
  readonly capCenter?: Vec;
  readonly half: Vec;
}

export interface ForwardHeading {
  readonly farMouth?: MouthIndex;
  readonly mouths: readonly [ForwardMouth, ForwardMouth];
  readonly tailEdge?: readonly [Vec, Vec];
}

export type ForwardFlightJets = readonly ForwardHeading[];

const fields = (value: unknown) =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

function point(value: unknown): Vec | undefined {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return { x: value[0], y: value[1] };
  }
  return undefined;
}

function readMouth(value: unknown): ForwardMouth | undefined {
  const mouth = fields(value);
  const anchor = point(mouth?.anchor);
  const half = point(mouth?.half);
  const capCenter = point(mouth?.capCenter);
  if (!anchor || !half || (!half.x && !half.y) || (mouth?.capCenter !== undefined && !capCenter)) {
    return undefined;
  }
  return capCenter ? { anchor, capCenter, half } : { anchor, half };
}

export function readForwardFlightJets(value: unknown): ForwardFlightJets | undefined {
  const root = fields(value);
  if (
    root?.version !== 1 ||
    root.frame !== FRAME ||
    !Array.isArray(root.headings) ||
    root.headings.length !== SHIP_HEADINGS
  ) {
    return undefined;
  }
  const headings: ForwardHeading[] = [];
  for (const entry of root.headings) {
    const heading = fields(entry);
    const index = heading?.index;
    const mouths = heading?.mouths;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= SHIP_HEADINGS ||
      headings[index] ||
      !Array.isArray(mouths) ||
      mouths.length !== 2
    ) {
      return undefined;
    }
    const first = readMouth(mouths[0]);
    const second = readMouth(mouths[1]);
    const farMouth = heading?.farMouth;
    if (!first || !second || (farMouth !== undefined && farMouth !== 0 && farMouth !== 1)) {
      return undefined;
    }
    const edge = heading?.tailEdge;
    let tailEdge: ForwardHeading["tailEdge"];
    if (edge !== undefined) {
      const a = Array.isArray(edge) && edge.length === 2 ? point(edge[0]) : undefined;
      const b = Array.isArray(edge) && edge.length === 2 ? point(edge[1]) : undefined;
      if (farMouth === undefined || !a || !b || (a.x === b.x && a.y === b.y)) {
        return undefined;
      }
      tailEdge = [a, b];
    }
    headings[index] = {
      mouths: [first, second],
      ...(farMouth === undefined ? {} : { farMouth }),
      ...(tailEdge === undefined ? {} : { tailEdge }),
    };
  }
  return headings;
}

export interface ForwardPlume {
  readonly alpha: number;
  readonly color: number;
  readonly mouth: MouthIndex;
  readonly points: readonly Vec[];
}

function reshape(points: readonly Vec[], axis: Vec, midpoint?: Vec): readonly Vec[] {
  const axial = (p: Vec) => p.x * axis.x + p.y * axis.y;
  const cross = (p: Vec) => p.y * axis.x - p.x * axis.y;
  const fromAxes = (u: number, v: number) => ({
    x: u * axis.x - v * axis.y,
    y: u * axis.y + v * axis.x,
  });
  const extra = END_ON_EXTRA * axis.y ** 4;
  const start = axial(points[0]!);
  const span = points.reduce((end, p) => Math.max(end, axial(p)), start) - start;
  const stretch = (p: Vec) => {
    const amount = Math.max(0, axial(p) - start - span * FIXED_ROOT);
    const drift = (extra * amount) / (1 - FIXED_ROOT);
    return { x: p.x + axis.x * drift, y: p.y + axis.y * drift };
  };
  if (!midpoint) {
    return extra === 0 ? points : points.map(stretch);
  }
  const base = axial(midpoint);
  const left = cross(points[0]!);
  const right = cross(points.at(-1)!);
  const center = cross(midpoint);
  const halfWidth = (left - right) / 2;
  const originalCenter = (left + right) / 2;
  const cap = (offset: number) =>
    fromAxes(base + CAP_CURVE * (1 - Math.sqrt(1 - offset ** 2)), center + halfWidth * offset);
  const outline = [cap(1)];
  for (let index = 1; index < points.length - 1; index++) {
    const p = stretch(points[index]!);
    outline.push(
      fromAxes(
        Math.max(base + CAP_CURVE + CAP_CLEARANCE, axial(p)),
        cross(p) + center - originalCenter,
      ),
    );
  }
  for (let index = 0; index < 16; index++) {
    outline.push(cap(index / 8 - 1));
  }
  return outline;
}

export function forwardFlightPoint(display: JetDisplay, { x, y }: Vec): Vec {
  return {
    x: (x / FRAME - display.pivot.x) * display.displayWidth,
    y: (y / FRAME - display.pivot.y) * display.displayHeight,
  };
}

/** The flight sidecar supplies placement only. The selected layers still own color, alpha and reach. */
export function forwardFlightPlumes(
  jets: ShipJets,
  heading: ForwardHeading,
  index: number,
  display: JetDisplay,
  speed: number,
): ForwardPlume[] | undefined {
  const axes = jets.headings[index];
  if (jets.frame !== FRAME || axes?.length !== 2 || !(speed > 0)) {
    return undefined;
  }
  const fraction = Math.min(1, speed);
  const length = jetLength(jets, fraction);
  const plumes: ForwardPlume[] = [];
  for (const mouth of [0, 1] as const) {
    const data = heading.mouths[mouth];
    const { axis } = axes[mouth]!;
    const magnitude = Math.hypot(axis.x, axis.y);
    if (!(magnitude > 0)) {
      return undefined;
    }
    const unit = { x: axis.x / magnitude, y: axis.y / magnitude };
    for (const { layerIndex, points } of jetShapePolygons(
      { ...data, axis },
      jets.layers,
      length,
      fraction,
      jets.profile,
    )) {
      const layer = jets.layers[layerIndex]!;
      if (
        layer.underHull ||
        Math.max(display.displayWidth, display.displayHeight) > (layer.maxDisplay ?? Infinity)
      ) {
        continue;
      }
      plumes.push({
        alpha: layerAlpha(layer, fraction),
        color: layerColor(layer, fraction),
        mouth,
        points: reshape(points, unit, data.capCenter).map((point) =>
          forwardFlightPoint(display, point),
        ),
      });
    }
  }
  return plumes;
}
