import type { StoryOverlay, StoryScenePreview } from "../../art/index.ts";
import { storyOverlayCrop } from "./storyCompositions.ts";

export type { StoryScenePreview } from "../../art/index.ts";

/** The existing story overlay node, shared by the scene and its thumbnail. */
export function createStoryOverlay(
  overlay: StoryOverlay,
  node = document.createElement("div"),
): HTMLDivElement {
  node.className = "ada-story-overlay";
  node.dataset.overlay = overlay.id;
  const { box } = overlay;
  Object.assign(node.style, {
    backgroundImage: `url('${overlay.url}')`,
    ...storyOverlayCrop(overlay.source),
    height: `${box.height}%`,
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
  });
  return node;
}

/** Apply a resolved canonical scene without another parser or a baked thumbnail. */
export function setStoryScenePreview(
  scene: StoryScenePreview | undefined,
  legacyUrl: string | undefined,
  target: HTMLElement,
): void {
  target.style.backgroundImage =
    scene?.url || legacyUrl ? `url('${scene?.url ?? legacyUrl}')` : "none";
  target.replaceChildren(...(scene?.overlays.map((overlay) => createStoryOverlay(overlay)) ?? []));
}
