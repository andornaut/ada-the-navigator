import { ASTRA, type Background, BACKGROUND_ART } from "../data/storybook.ts";
import { STORY_BACKGROUND } from "./layout/storyPage.ts";

// Art's storybook backgrounds, the rock glow transitions and Astra's speaking frames
// (art/storybook.md, art/cockpit.md), read from the root manifest and the story transition file
// it links as storyTransition.

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
  readonly width?: number;
}

export interface StoryArtManifest {
  readonly assets?: readonly ArtAsset[];
  readonly storyTransition?: string;
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

/** Astra's speaking sheet from the manifest, placed on the background canvas, or null. */
export function readAstraSpeaking(assets: readonly ArtAsset[]): AstraSpeaking | null {
  const entry = assets.find(({ id }) => id === ASTRA_SPEAKING_ID);
  const { at, displayHeight, displayWidth, frameWidth, loop, width } = entry ?? {};
  if (!entry || !at || !displayHeight || !displayWidth || !frameWidth || !width || !loop?.length) {
    return null;
  }
  const frameCount = Math.round(width / frameWidth);
  if (loop.some(({ frame, ms }) => frame < 0 || frame >= frameCount || ms <= 0)) {
    return null;
  }
  const percent = (value: number, of: number) => (value / of) * 100;
  return {
    box: {
      height: percent(displayHeight, STORY_BACKGROUND.height),
      left: percent(at.x, STORY_BACKGROUND.width),
      top: percent(at.y, STORY_BACKGROUND.height),
      width: percent(displayWidth, STORY_BACKGROUND.width),
    },
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

/** Fetches the manifest and its story transition file; no art, or no transitions, past a failure. */
export async function loadStoryArt(): Promise<StoryArt> {
  const manifest = (await fetchJson(ART_MANIFEST_URL).catch(() => ({}))) as StoryArtManifest;
  const assets = manifest.assets ?? [];
  const transition = manifest.storyTransition
    ? await fetchJson(manifest.storyTransition).catch(() => ({}))
    : {};
  return {
    astra: readAstraSpeaking(assets),
    backgrounds: storyBackgrounds(assets),
    transitions: readStoryTransitions(assets, transition),
  };
}
