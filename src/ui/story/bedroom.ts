import { type Background, BACKGROUND_ART } from "../../data/storybook.ts";
import { roomBackground, type StoryPage } from "../../model/storybook.ts";
import {
  PAUSE_BUTTON,
  type Size,
  SPACING,
  STORY_BACKGROUND,
  storyBackgroundScale,
} from "../layout/index.ts";
import type { CanvasBox } from "./storyArt.ts";

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

/** Keep the occupied pose and Menu apart, shifting the shared canvas only within its cover. */
export function bedroomSideOffset(
  view: Size,
  occupied: Pick<CanvasBox, "left" | "width">,
  hudLeft: number,
): number {
  const canvas = STORY_BACKGROUND.width * storyBackgroundScale(view);
  const overhang = (canvas - view.width) / 2;
  const left = (occupied.left / 100) * canvas - overhang;
  const right = left + (occupied.width / 100) * canvas;
  const { art, hit } = PAUSE_BUTTON;
  const menuRight = hudLeft + hit.x + (hit.width + art.width) / 2;
  const minimum = menuRight + SPACING.gap - left;
  const maximum = view.width - SPACING.gap - right;
  const offset =
    minimum > maximum ? (minimum + maximum) / 2 : Math.max(minimum, Math.min(maximum, 0));
  return Math.max(-overhang, Math.min(overhang, offset));
}

/** The room at the end of an overnight visit keeps that visit's explicit morning light. */
export function bedroomBackground(
  run: readonly StoryPage[] | undefined,
  key: Background,
): Background {
  return key === "adaRoom" ? roomBackground(run ?? []) : key;
}
