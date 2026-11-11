import { type Background, CHAPTER_BACKGROUNDS } from "../data/storybook.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";

/** A choice and the branch page it leads to; without one, the choice ends the scene. */
export interface StoryChoice {
  readonly label: string;
  readonly next?: string;
}
/** One storybook page: a location background with its text or dialogue panel. */
export interface StoryPage {
  readonly id: string;
  readonly background: Background;
  /** The speaker or panel title; absent for untitled narration. */
  readonly speaker?: string;
  /** The page's text; empty on a page that only offers its action. */
  readonly text: string;
  /** A choice page's two or three choices; the first is the default. */
  readonly choices?: readonly StoryChoice[];
  /** The page after this one; absent on the scene's last page and on choice pages. */
  readonly next?: string;
  /** A named action shown in Next's place, such as "Pick up the rock.". */
  readonly action?: string;
  /** Showing this page uses up the once-only new galaxy announcement. */
  readonly announces?: boolean;
}
export type SceneEffect =
  | { readonly kind: "opened"; readonly galaxy: SectorId }
  | { readonly kind: "prologue" }
  | { readonly kind: "resolved"; readonly galaxy: SectorId };
/** What follows a scene: more Earth scenes, the cockpit's boarding, or galaxy selection. */
export type SceneLead = "home" | "board" | "select";
export interface Scene {
  readonly id: string;
  /** In reading order; the first page opens the scene. */
  readonly pages: readonly StoryPage[];
  /** The scene's last page, where Skip arrives. */
  readonly last: string;
  /** Applied when the scene ends. */
  readonly effect?: SceneEffect;
  readonly lead: SceneLead;
}
/** A place in a scene, with the pages read before it for Previous. */
export interface StoryPosition {
  readonly scene: Scene;
  readonly page: string;
  readonly trail: readonly string[];
}

export interface StoryLabels {
  readonly pickUpRock: string;
}

function lookup(scene: Scene, id: string): StoryPage {
  const page = scene.pages.find((candidate) => candidate.id === id);
  if (!page) {
    throw new Error(`Unknown page ${id} in ${scene.id}`);
  }
  return page;
}

export function currentPage(position: StoryPosition): StoryPage {
  return lookup(position.scene, position.page);
}

export function storyStart(scene: Scene): StoryPosition {
  const first = scene.pages[0];
  if (!first) {
    throw new Error(`Empty scene ${scene.id}`);
  }
  return { page: first.id, scene, trail: [] };
}

/** Previous is disabled on a scene's first page. */
export function canGoBack(position: StoryPosition): boolean {
  return position.trail.length > 0;
}

export function goBack(position: StoryPosition): StoryPosition {
  const page = position.trail.at(-1);
  return page === undefined ? position : { ...position, page, trail: position.trail.slice(0, -1) };
}

/** The page reached by Next or a choice, or null when the scene ends. */
export function advance(position: StoryPosition, choice?: number): StoryPosition | null {
  const page = currentPage(position);
  const next =
    page.choices && page.choices.length > 0
      ? page.choices[Math.min(Math.max(choice ?? 0, 0), page.choices.length - 1)]?.next
      : page.next;
  return next === undefined
    ? null
    : { ...position, page: next, trail: [...position.trail, position.page] };
}

/**
 * Skip: follows the default path (the first choice) to the scene's last page. On the last page
 * itself, it takes the default and ends the scene (null).
 */
export function skip(position: StoryPosition): StoryPosition | null {
  let here: StoryPosition | null = position;
  if (position.page === position.scene.last) {
    return advance(position, 0);
  }
  for (let steps = 0; here && here.page !== here.scene.last; steps++) {
    if (steps > position.scene.pages.length) {
      throw new Error(`No default path to the end of ${position.scene.id}`);
    }
    here = advance(here, 0);
  }
  return here;
}

/** A chapter's home opening: its text and choices, which rejoin as the scene ends. */
export function openingScene(content: PrototypeContent, galaxy: SectorId): Scene {
  const chapter = content.chapters[galaxy];
  return {
    effect: { galaxy, kind: "opened" },
    id: `opening:${galaxy}`,
    last: "opening",
    lead: "home",
    pages: [
      {
        background: CHAPTER_BACKGROUNDS[galaxy].opening,
        choices: chapter.openingChoices.map((label) => ({ label })),
        id: "opening",
        speaker: chapter.name,
        text: chapter.opening,
      },
    ],
  };
}

/** A chapter's home resolution: its text and choices, rejoining at the closing. */
export function resolutionScene(content: PrototypeContent, galaxy: SectorId): Scene {
  const chapter = content.chapters[galaxy];
  const backgrounds = CHAPTER_BACKGROUNDS[galaxy];
  return {
    effect: { galaxy, kind: "resolved" },
    id: `resolution:${galaxy}`,
    last: "closing",
    lead: "home",
    pages: [
      {
        background: backgrounds.resolution,
        choices: chapter.resolutionChoices.map((label) => ({ label, next: "closing" })),
        id: "resolution",
        speaker: chapter.name,
        text: chapter.resolution,
      },
      {
        background: backgrounds.closing,
        id: "closing",
        speaker: chapter.name,
        text: chapter.closing,
      },
    ],
  };
}

/**
 * The prologue: Ada's room with the glowing rock, then the cockpit, where Astra's optional
 * questions are the choice page's choices, each answered on one branch page.
 */
export function prologueScene(content: PrototypeContent): Scene {
  const { prologue, title } = content.premise;
  const pages: StoryPage[] = [];
  prologue.forEach((step, index) => {
    const id = `prologue:${index}`;
    const following = index + 1 < prologue.length ? `prologue:${index + 1}` : undefined;
    const speaker = step.speaker ?? title;
    const background: Background = index === 0 ? "adaRoom" : "cockpit";
    if (step.questions) {
      pages.push({
        background,
        choices: step.questions.map(({ question }, choice) => ({
          label: question,
          next: `${id}:answer:${choice}`,
        })),
        id,
        speaker,
        text: step.text,
      });
      step.questions.forEach(({ answer }, choice) => {
        pages.push({
          background,
          id: `${id}:answer:${choice}`,
          ...(following ? { next: following } : {}),
          speaker,
          text: answer,
        });
      });
      return;
    }
    pages.push({
      background,
      id,
      ...(step.choice ? { action: step.choice } : {}),
      ...(following ? { next: following } : {}),
      speaker,
      text: step.text,
    });
  });
  return {
    effect: { kind: "prologue" },
    id: "prologue",
    last: `prologue:${prologue.length - 1}`,
    lead: "select",
    pages,
  };
}

/** Ada's room with the rock, after a scene that leads aboard; empty visits add Penny's line. */
export function roomScene(content: PrototypeContent, labels: StoryLabels, empty: boolean): Scene {
  return {
    id: empty ? "room:empty" : "room",
    last: "room",
    lead: "board",
    pages: [
      {
        action: labels.pickUpRock,
        background: "adaRoom",
        id: "room",
        text: empty ? content.premise.emptyHome : "",
      },
    ],
  };
}

/** Boarding in the cockpit; once after a galaxy unlocks, Astra announces it instead. */
export function boardingScene(content: PrototypeContent, announce: boolean): Scene {
  const { boarding, boardingNewGalaxy, title } = content.premise;
  const pages = boarding.map((line, index): StoryPage => {
    const last = index === boarding.length - 1;
    const spoken = last && announce ? boardingNewGalaxy : line;
    return {
      background: "cockpit",
      id: `boarding:${index}`,
      ...(last ? {} : { next: `boarding:${index + 1}` }),
      ...(last && announce ? { announces: true } : {}),
      speaker: spoken.speaker ?? title,
      text: spoken.text,
    };
  });
  return { id: "boarding", last: `boarding:${boarding.length - 1}`, lead: "select", pages };
}
