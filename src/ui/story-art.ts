import { ASTRA, type Background, BACKGROUND_ART } from "../data/storybook.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";

// Art's storybook backgrounds, their composite overlays, the rock glow transitions, the overnight
// sequence and Astra's speaking frames (art/storybook.md, art/cockpit.md), read from the root
// manifest and the story transition and overnight files it links as storyTransition and
// storyOvernight.

export const ART_MANIFEST_URL = "/art/manifest.json";

/** The sheet of Astra's speaking frames, drawn over either cockpit while she speaks. */
export const ASTRA_SPEAKING_ID = "cockpit-astra";

/** The backgrounds Astra's lens shows on. */
export const COCKPIT_BACKGROUNDS: readonly Background[] = ["cockpit", "cockpitSeated"];

export interface ArtAsset {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly id: string;
  readonly path: string;
  /** A sheet's frame layout, loop and top-left on the background canvas, in logical px. */
  readonly at?: { readonly x: number; readonly y: number };
  readonly frameWidth?: number;
  readonly loop?: readonly { readonly frame: number; readonly ms: number }[];
  /** A composite background's overlay entries, drawn over its path in order. */
  readonly overlays?: readonly string[];
  readonly width?: number;
}

export interface StoryArtManifest {
  readonly assets?: readonly ArtAsset[];
  readonly storyOvernight?: string;
  readonly storyTransition?: string;
}

/** A box on the background canvas, as percentages of its width and height. */
export interface CanvasBox {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** An image drawn over a background at its manifest `at`, such as the sleep scene's figures. */
export interface StoryOverlay {
  readonly box: CanvasBox;
  readonly id: string;
  readonly url: string;
}

/**
 * One step of the overnight sequence (art/storybook.md "Sequence"): fade an overlay in, breathe
 * an overlay's alpha once, or cross-fade the whole picture to a background, which ends the
 * overlays.
 */
export type OvernightStep =
  | {
      readonly fadeMs: number;
      readonly holdMs: number;
      readonly kind: "overlay";
      readonly overlay: StoryOverlay;
    }
  | { readonly kind: "breath"; readonly ms: number; readonly overlay: StoryOverlay }
  | {
      readonly fadeMs: number;
      readonly holdMs: number;
      readonly kind: "background";
      readonly url: string;
    };

/** The overnight sequence on the sleep page, with its reduced-motion replacement and totals. */
export interface Overnight {
  readonly durationMs: number;
  readonly from: string;
  readonly overlays: readonly StoryOverlay[];
  readonly reducedMotion: readonly OvernightStep[];
  readonly reducedMotionMs: number;
  readonly sleep: string;
  readonly steps: readonly OvernightStep[];
  readonly to: string;
}

/** One cross-fade to an image over fadeMs (0 cuts), then a hold of holdMs. */
export interface TransitionStep {
  readonly fadeMs: number;
  readonly holdMs: number;
  readonly url: string;
}

/** A transition between two backgrounds' images, with its reduced-motion replacement. */
export interface StoryTransition {
  readonly from: string;
  readonly reducedMotion: readonly TransitionStep[];
  readonly steps: readonly TransitionStep[];
  readonly to: string;
}

/** One frame of a looping sheet, held for ms. */
export interface SheetFrame {
  readonly frame: number;
  readonly ms: number;
}

/** Astra's speaking sheet: its frames and its box as percentages of the background canvas. */
export interface AstraSpeaking {
  readonly box: {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
  };
  readonly frameCount: number;
  readonly loop: readonly SheetFrame[];
  readonly url: string;
}

export interface StoryArt {
  readonly astra: AstraSpeaking | null;
  readonly backgrounds: Partial<Record<Background, string>>;
  /** Each composite background's overlays, drawn over its image. */
  readonly composites: Partial<Record<Background, readonly StoryOverlay[]>>;
  readonly overnight: Overnight | null;
  readonly transitions: readonly StoryTransition[];
}

const urls = (assets: readonly ArtAsset[]) => new Map(assets.map(({ id, path }) => [id, path]));

/** Each background key's image URL, for the keys whose asset the manifest lists. */
export function storyBackgrounds(assets: readonly ArtAsset[]): Partial<Record<Background, string>> {
  const byId = urls(assets);
  return Object.fromEntries(
    Object.entries(BACKGROUND_ART).flatMap(([key, id]) => {
      const url = byId.get(id);
      return url ? [[key, url]] : [];
    }),
  ) as Partial<Record<Background, string>>;
}

function readSteps(
  byId: ReadonlyMap<string, string>,
  value: unknown,
): readonly TransitionStep[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const steps = (value as unknown[]).map((entry) => {
    const { background, fadeMs, holdMs } = (entry ?? {}) as Record<string, unknown>;
    const url = typeof background === "string" ? byId.get(background) : undefined;
    return url !== undefined &&
      typeof fadeMs === "number" &&
      typeof holdMs === "number" &&
      fadeMs >= 0 &&
      holdMs >= 0
      ? { fadeMs, holdMs, url }
      : null;
  });
  return steps.every((step) => step !== null) ? steps : null;
}

/**
 * The transitions in Art's story transition file, each from its `from` image to its steps' last
 * image; one naming an asset the manifest lacks, or whose reduced-motion steps end elsewhere, is
 * left out.
 */
export function readStoryTransitions(
  assets: readonly ArtAsset[],
  data: unknown,
): StoryTransition[] {
  const byId = urls(assets);
  return Object.entries((data ?? {}) as Record<string, unknown>).flatMap(([name, value]) => {
    if (name === "version" || typeof value !== "object" || value === null) {
      return [];
    }
    const record = value as Record<string, unknown>;
    const from = typeof record.from === "string" ? byId.get(record.from) : undefined;
    const steps = readSteps(byId, record.steps);
    const reducedMotion = readSteps(byId, record.reducedMotion);
    const to = steps?.at(-1)?.url;
    return from && steps && reducedMotion && to && reducedMotion.at(-1)?.url === to
      ? [{ from, reducedMotion, steps, to }]
      : [];
  });
}

/** The steps that play from one page's image to the next's, or null where the change cuts. */
export function transitionSteps(
  transitions: readonly StoryTransition[],
  from: string | undefined,
  to: string | undefined,
  reducedMotion: boolean,
): readonly TransitionStep[] | null {
  const transition = transitions.find((entry) => entry.from === from && entry.to === to);
  return transition ? (reducedMotion ? transition.reducedMotion : transition.steps) : null;
}

/**
 * An entry's box on the background canvas from its `at` (its top-left, logical px) and display
 * size, or null if it has no placement. Astra's sheet and every overlay are placed this way.
 */
function canvasBox(entry: ArtAsset): CanvasBox | null {
  const { at, displayHeight, displayWidth } = entry;
  if (!at || !displayHeight || !displayWidth) {
    return null;
  }
  const percent = (value: number, of: number) => (value / of) * 100;
  return {
    height: percent(displayHeight, STORY_BACKGROUND.height),
    left: percent(at.x, STORY_BACKGROUND.width),
    top: percent(at.y, STORY_BACKGROUND.height),
    width: percent(displayWidth, STORY_BACKGROUND.width),
  };
}

/** A manifest entry placed over a background by its `at`, or null if it is missing or unplaced. */
export function readOverlay(assets: readonly ArtAsset[], id: string): StoryOverlay | null {
  const entry = assets.find((asset) => asset.id === id);
  const box = entry && canvasBox(entry);
  return entry && box ? { box, id, url: entry.path } : null;
}

/**
 * Each composite background's overlays: a background entry whose `overlays` lists entries drawn
 * over its path. A composite naming a missing or unplaced overlay draws as its path alone.
 */
export function storyComposites(
  assets: readonly ArtAsset[],
): Partial<Record<Background, readonly StoryOverlay[]>> {
  return Object.fromEntries(
    Object.entries(BACKGROUND_ART).flatMap(([key, id]) => {
      const names = assets.find((asset) => asset.id === id)?.overlays ?? [];
      const overlays = names.map((name) => readOverlay(assets, name));
      return names.length > 0 && overlays.every((overlay) => overlay !== null)
        ? [[key, overlays]]
        : [];
    }),
  ) as Partial<Record<Background, readonly StoryOverlay[]>>;
}

const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function readOvernightSteps(
  overlays: ReadonlyMap<string, StoryOverlay>,
  byId: ReadonlyMap<string, string>,
  value: unknown,
): OvernightStep[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const steps = (value as unknown[]).map((entry): OvernightStep | null => {
    const step = (entry ?? {}) as Record<string, unknown>;
    if (typeof step.breath === "string") {
      const overlay = overlays.get(step.breath);
      return overlay && nonnegative(step.ms) && step.ms > 0
        ? { kind: "breath", ms: step.ms, overlay }
        : null;
    }
    if (!nonnegative(step.fadeMs) || !nonnegative(step.holdMs)) {
      return null;
    }
    if (typeof step.overlay === "string") {
      const overlay = overlays.get(step.overlay);
      return overlay
        ? { fadeMs: step.fadeMs, holdMs: step.holdMs, kind: "overlay", overlay }
        : null;
    }
    const url = typeof step.background === "string" ? byId.get(step.background) : undefined;
    return url ? { fadeMs: step.fadeMs, holdMs: step.holdMs, kind: "background", url } : null;
  });
  return steps.every((step) => step !== null) ? steps : null;
}

/** How long a list of overnight steps plays. */
export function overnightMs(steps: readonly OvernightStep[]): number {
  return steps.reduce(
    (sum, step) => sum + (step.kind === "breath" ? step.ms : step.fadeMs + step.holdMs),
    0,
  );
}

/**
 * Art's overnight sequence (story-overnight.json), or null if any part is missing: each named
 * background and overlay in the manifest, each overlay at its manifest `at`, both step lists
 * ending on the `to` background and each matching its stated total.
 */
export function readOvernight(assets: readonly ArtAsset[], data: unknown): Overnight | null {
  const record = (data as { overnight?: unknown } | null)?.overnight;
  if (!record || typeof record !== "object") {
    return null;
  }
  const value = record as Record<string, unknown>;
  const byId = urls(assets);
  const image = (id: unknown) => (typeof id === "string" ? byId.get(id) : undefined);
  const from = image(value.from);
  const sleep = image(value.sleep);
  const to = image(value.to);
  const placed = Object.entries((value.overlays ?? {}) as Record<string, unknown>).map(
    ([id, entry]) => {
      const at = (entry as { at?: { x?: unknown; y?: unknown } } | null)?.at;
      const manifest = assets.find((asset) => asset.id === id)?.at;
      const overlay = readOverlay(assets, id);
      return overlay && manifest && at?.x === manifest.x && at.y === manifest.y ? overlay : null;
    },
  );
  if (
    !from ||
    !sleep ||
    !to ||
    placed.length === 0 ||
    !placed.every((overlay) => overlay !== null)
  ) {
    return null;
  }
  const overlays = new Map(placed.map((overlay) => [overlay.id, overlay]));
  const steps = readOvernightSteps(overlays, byId, value.steps);
  const reducedMotion = readOvernightSteps(overlays, byId, value.reducedMotion);
  const ends = (list: readonly OvernightStep[] | null) => {
    const last = list?.at(-1);
    return last?.kind === "background" && last.url === to;
  };
  if (
    !steps ||
    !reducedMotion ||
    !ends(steps) ||
    !ends(reducedMotion) ||
    overnightMs(steps) !== value.durationMs ||
    overnightMs(reducedMotion) !== value.reducedMotionMs
  ) {
    return null;
  }
  return {
    durationMs: overnightMs(steps),
    from,
    overlays: placed,
    reducedMotion,
    reducedMotionMs: overnightMs(reducedMotion),
    sleep,
    steps,
    to,
  };
}

/** The overnight steps that play, the reduced-motion ones when motion is reduced. */
export function overnightSteps(
  overnight: Overnight,
  reducedMotion: boolean,
): readonly OvernightStep[] {
  return reducedMotion ? overnight.reducedMotion : overnight.steps;
}

/** How long the sleep page lasts, in seconds: its overnight steps' total. */
export function overnightSeconds(overnight: Overnight, reducedMotion: boolean): number {
  return (reducedMotion ? overnight.reducedMotionMs : overnight.durationMs) / 1000;
}

/** A breath's alpha `ms` into it: `(1 - cos(2 pi t / ms)) / 2`, 0 at both ends and 1 midway. */
export function breathAlpha(ms: number, t: number): number {
  return (1 - Math.cos((2 * Math.PI * t) / ms)) / 2;
}

/** A breath as linear keyframes, `samples` intervals of its alpha curve. */
export function breathKeyframes(samples: number): { offset: number; opacity: number }[] {
  return Array.from({ length: samples + 1 }, (_, index) => ({
    offset: index / samples,
    opacity: breathAlpha(1, index / samples),
  }));
}

/** Astra's speaking sheet from the manifest, placed on the background canvas, or null. */
export function readAstraSpeaking(assets: readonly ArtAsset[]): AstraSpeaking | null {
  const entry = assets.find(({ id }) => id === ASTRA_SPEAKING_ID);
  const box = entry && canvasBox(entry);
  const { frameWidth, loop, width } = entry ?? {};
  if (!entry || !box || !frameWidth || !width || !loop?.length) {
    return null;
  }
  const frameCount = Math.round(width / frameWidth);
  if (loop.some(({ frame, ms }) => frame < 0 || frame >= frameCount || ms <= 0)) {
    return null;
  }
  return {
    box,
    frameCount,
    loop: loop.map(({ frame, ms }) => ({ frame, ms })),
    url: entry.path,
  };
}

/** Whether Astra's lens animates on a page: a cockpit page she speaks. */
export function astraSpeaks(page: { readonly background: Background; readonly speaker?: string }) {
  return page.speaker === ASTRA && COCKPIT_BACKGROUNDS.includes(page.background);
}

/** The frames a speaking page cycles through: the loop, or its first frame held. */
export function speakingFrames(
  astra: AstraSpeaking,
  reducedMotion: boolean,
): readonly SheetFrame[] {
  return reducedMotion ? astra.loop.slice(0, 1) : astra.loop;
}

/** A frame's horizontal background position on a sheet of frameCount frames. */
export function framePosition(astra: AstraSpeaking, frame: number): string {
  return astra.frameCount > 1 ? `${(frame / (astra.frameCount - 1)) * 100}%` : "0%";
}

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.json();
};

/**
 * Fetches the manifest and its story transition and overnight files; no art, no transitions or
 * no overnight sequence past a failure.
 */
export async function loadStoryArt(): Promise<StoryArt> {
  const manifest = (await fetchJson(ART_MANIFEST_URL).catch(() => ({}))) as StoryArtManifest;
  const assets = manifest.assets ?? [];
  const linked = (url: string | undefined) =>
    url ? fetchJson(url).catch(() => ({})) : Promise.resolve({});
  const [transition, overnight] = await Promise.all([
    linked(manifest.storyTransition),
    linked(manifest.storyOvernight),
  ]);
  return {
    astra: readAstraSpeaking(assets),
    backgrounds: storyBackgrounds(assets),
    composites: storyComposites(assets),
    overnight: readOvernight(assets, overnight),
    transitions: readStoryTransitions(assets, transition),
  };
}
