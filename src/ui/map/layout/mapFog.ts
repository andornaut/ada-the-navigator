export interface FogEllipse {
  readonly rx: number;
  readonly ry: number;
  readonly sigma: number;
}

export interface FogStampBounds extends FogEllipse {
  readonly clipHeight: number;
  readonly clipWidth: number;
  readonly height: number;
  readonly padding: number;
  readonly pixels: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/** Device-pixel Gaussian support, mirrored stamp extents and exact bitmap budget. */
export function fogStampBounds({ rx, ry, sigma }: FogEllipse): FogStampBounds {
  const padding = Math.ceil(8 * sigma + 2);
  const x = Math.ceil(rx) + padding + 1;
  const y = Math.ceil(ry) + padding + 1;
  return {
    clipHeight: Math.ceil(2 * ry) + 2 * padding + 2,
    clipWidth: Math.ceil(2 * rx) + 2 * padding + 2,
    height: 2 * y,
    padding,
    pixels: 4 * x * y,
    rx,
    ry,
    sigma,
    width: 2 * x,
    x,
    y,
  };
}
