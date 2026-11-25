// Pure plume geometry shared by every drawing of Ada's exhaust: the teardrop outline of one
// layer from a mouth's projected root, axis and side vectors.
export type Xy = readonly [number, number];

export interface PlumeMouth {
  /** Projected plume root. */
  readonly anchor: Xy;
  /** Projected exhaust direction per ship unit. */
  readonly axis: Xy;
  /** Projected vector across the plume per ship unit. */
  readonly half: Xy;
}

export interface PlumeLayer {
  readonly colors: readonly [string, string];
  /** Multiple of the jet length. */
  readonly length: number;
  /** Half width in ship units. */
  readonly width: number;
}

export interface JetCurve {
  readonly base: number;
  readonly exponent: number;
  readonly scale: number;
}

/** Jet length in ship units at speed fraction f. */
export const jetLength = (curve: JetCurve, f: number) =>
  curve.base + curve.scale * Math.min(1, f) ** curve.exponent;

/** One layer's closed outline: down one side of the profile to the tip and back up the other. */
export function plumePolygon(
  profile: readonly (readonly [number, number])[],
  mouth: PlumeMouth,
  layer: Pick<PlumeLayer, "length" | "width">,
  length: number,
): Xy[] {
  const at = (t: number, w: number): Xy => [
    mouth.anchor[0] + mouth.axis[0] * t * length * layer.length + mouth.half[0] * w * layer.width,
    mouth.anchor[1] + mouth.axis[1] * t * length * layer.length + mouth.half[1] * w * layer.width,
  ];
  return [
    ...profile.map(([t, w]) => at(t, w)),
    ...profile
      .slice(0, -1)
      .toReversed()
      .map(([t, w]) => at(t, -w)),
  ];
}

/** A layer's colour at speed fraction f, interpolated linearly in sRGB. */
export function plumeColor([from, to]: readonly [string, string], f: number): string {
  const t = Math.min(1, Math.max(0, f));
  return `#${[1, 3, 5]
    .map((i) => {
      const [a, b] = [from, to].map((c) => Number.parseInt(c.slice(i, i + 2), 16));
      return Math.round(a! + (b! - a!) * t)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}
