import type { Background } from "../data/storybook.ts";

export interface StorySourceRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
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
  readonly source?: {
    readonly height: number;
    readonly rect: StorySourceRect;
    readonly width: number;
  };
}

export interface StoryScenePreview {
  readonly overlays: readonly StoryOverlay[];
  readonly url: string;
}

export interface StoryBackgroundArt {
  readonly backgrounds: Partial<Record<Background, string>>;
  /** Each composite background's overlays, drawn over its image. */
  readonly composites: Partial<Record<Background, readonly StoryOverlay[]>>;
}
