import { type Background, BACKGROUND_ART } from "../data/storybook.ts";
import { roomBackground, type StoryPage } from "../model/storybook.ts";
import type { Size } from "./layout/playView.ts";
import { STORY_BACKGROUND, storyBackgroundScale } from "./layout/storyPage.ts";

/** Shared room canvases keep their floor at the view's bottom, independently of dialogue. */
export function bedroomTop(view: Size, key: Background): number | null {
  if (
    !(key in BACKGROUND_ART) ||
    !BACKGROUND_ART[key as keyof typeof BACKGROUND_ART].startsWith("story-ada-room")
  ) {
    return null;
  }
  return view.height - STORY_BACKGROUND.height * storyBackgroundScale(view);
}

/** The room at the end of an overnight visit keeps that visit's explicit morning light. */
export function bedroomBackground(
  run: readonly StoryPage[] | undefined,
  key: Background,
): Background {
  return key === "adaRoom" ? roomBackground(run ?? []) : key;
}
