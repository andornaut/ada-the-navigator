import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { holodiskInsertion } from "../data/premiseCopy.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import {
  boardingScene,
  holodiskScene,
  jumpHomeScene,
  openingScene,
  prologueScene,
  resolutionScene,
  roomScene,
  type Scene,
  type StoryLabels,
} from "./storybook.ts";
import { isStoryRoomBackground, type StorySceneReference } from "./storyCursor.ts";

export interface StorySceneContext {
  readonly content: GameContent;
  readonly holodisks: number;
  readonly labels: StoryLabels;
}

/** References select existing authored factories without saving their text or applying effects. */
export function resolveStoryScene(
  context: StorySceneContext,
  reference: StorySceneReference,
): Scene | null {
  const { content, holodisks, labels } = context;
  const { background, id, variant } = reference;
  if (id === "room" || id === "room:empty") {
    return variant === undefined
      ? roomScene(content, labels, id === "room:empty", background)
      : null;
  }
  if (id === "boarding") {
    return variant === undefined || variant === "announce"
      ? boardingScene(content, variant === "announce", background)
      : null;
  }
  if (background !== undefined) {
    return null;
  }
  if (id === "prologue") {
    return variant === undefined ? prologueScene(content, labels) : null;
  }
  if (id === "jumpHome") {
    if (variant !== undefined && variant !== "oreLost") {
      return null;
    }
    const line = content.labels.jumpHome;
    const ore = content.labels.jumpHomeOreLost;
    const morning = content.labels.morningRecharge;
    if (!line || !ore || !morning) {
      return null;
    }
    return jumpHomeScene(variant === "oreLost" ? `${line}\n${ore}` : line, morning);
  }
  if (id === "holodisk") {
    return variant === undefined && holodisks > 0 && holodisks <= GALAXY_NUMBERS.length
      ? holodiskScene(
          holodiskInsertion(holodisks, content.premise.holodisk.inserted),
          content.premise.holodisk.memories[holodisks - 1] ?? "",
        )
      : null;
  }
  const chapter = /^(opening|resolution):([1-6])$/u.exec(id);
  if (!chapter) {
    return null;
  }
  const galaxy = Number(chapter[2]) as GalaxyNumber;
  if (!content.chapters[galaxy]) {
    return null;
  }
  if (chapter[1] === "resolution") {
    return variant === undefined ? resolutionScene(content, galaxy) : null;
  }
  return variant === undefined || (galaxy === 1 && variant === "firstLaunch")
    ? openingScene(content, galaxy, variant === "firstLaunch")
    : null;
}

/** The emergency scene's loss variant is supplied from its actual outcome by the model. */
export function referenceStoryScene(
  context: { readonly emergency: (scene: Scene) => StorySceneReference | undefined },
  scene: Scene,
): StorySceneReference {
  if (scene.id === "jumpHome") {
    const reference = context.emergency(scene);
    if (!reference) {
      throw new RangeError("Missing emergency story reference");
    }
    return reference;
  }
  if (scene.id === "room" || scene.id === "room:empty") {
    const background = scene.pages[0]?.background;
    if (!isStoryRoomBackground(background)) {
      throw new RangeError("Invalid room story background");
    }
    return { background, id: scene.id };
  }
  if (scene.id === "opening:1" && scene.pages.some((page) => page.id === "opening:farewell")) {
    return { id: scene.id, variant: "firstLaunch" };
  }
  if (scene.id === "boarding") {
    const background = scene.pages.find((page) => page.speaker === undefined)?.background;
    if (background !== undefined && !isStoryRoomBackground(background)) {
      throw new RangeError("Invalid boarding story background");
    }
    return {
      id: scene.id,
      ...(scene.pages.some((page) => page.announces) ? { variant: "announce" as const } : {}),
      ...(background === undefined ? {} : { background }),
    };
  }
  return { id: scene.id };
}
