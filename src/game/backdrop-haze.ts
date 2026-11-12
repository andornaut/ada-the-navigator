// A galaxy's backdrop haze (art/galaxies.md "Backdrop haze"): soft field-coloured shapes fixed to
// the screen, drawn over the field fill and under the dust specks, backdrop rocks and every play
// object, centred on the play view at its display size with linear filtering.

/** The haze texture's manifest entry and display size in logical px. */
export interface BackdropHaze {
  readonly asset: string;
  readonly height: number;
  readonly path: string;
  readonly width: number;
}

interface HazeAsset {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly id: string;
  readonly path: string;
}

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * A version 1 haze.json with the one placement Art specifies (layer `backdrop`, anchor `view`,
 * parallax 0, filter `linear`) and its texture's sized entry among `assets`; undefined otherwise,
 * so the galaxy draws no haze.
 */
export function readBackdropHaze(
  assets: readonly HazeAsset[],
  value: unknown,
): BackdropHaze | undefined {
  const data = (value ?? {}) as Record<string, unknown>;
  if (
    data.version !== 1 ||
    data.layer !== "backdrop" ||
    data.anchor !== "view" ||
    data.parallax !== 0 ||
    data.filter !== "linear" ||
    typeof data.asset !== "string"
  ) {
    return undefined;
  }
  const entry = assets.find(({ id }) => id === data.asset);
  if (!entry || !positive(entry.displayWidth) || !positive(entry.displayHeight)) {
    return undefined;
  }
  return {
    asset: entry.id,
    height: entry.displayHeight,
    path: entry.path,
    width: entry.displayWidth,
  };
}
