import { type Background, CHAPTER_BACKGROUNDS } from "../data/storybook.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";

/** A choice and the page it leads to; without one, the choice ends the scene. */
export interface StoryChoice {
  readonly label: string;
  readonly next?: string;
}
/** One storybook page: a location background with its text or dialogue panel. */
export interface StoryPage {
  readonly id: string;
  readonly background: Background;
  /** The speaker's name tab on a dialogue page; narration has none. */
  readonly speaker?: string;
  /** The page's text. */
  readonly text: string;
  /** A choice page's two or three choices, each leading to its branch; the first is the default. */
  readonly choices?: readonly StoryChoice[];
  /**
   * Optional questions: each answer page returns here, and an asked question leaves the list.
   * Continue (this page's next) moves on and is the default.
   */
  readonly questions?: readonly StoryChoice[];
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
/** A place in a scene, with the pages read before it for Previous and the questions asked. */
export interface StoryPosition {
  readonly scene: Scene;
  readonly page: string;
  readonly trail: readonly string[];
  readonly asked: readonly string[];
}

export interface StoryLabels {
  readonly continue: string;
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

/** The page's choices as shown: a choice page's, or the questions not yet asked. */
export function shownChoices(position: StoryPosition): readonly StoryChoice[] {
  const page = currentPage(position);
  return (
    page.choices ??
    (page.questions ?? []).filter(
      ({ next }) => next === undefined || !position.asked.includes(next),
    )
  );
}

export function storyStart(scene: Scene): StoryPosition {
  const first = scene.pages[0];
  if (!first) {
    throw new Error(`Empty scene ${scene.id}`);
  }
  return { asked: [], page: first.id, scene, trail: [] };
}

/** Previous is disabled on a scene's first page. */
export function canGoBack(position: StoryPosition): boolean {
  return position.trail.length > 0;
}

export function goBack(position: StoryPosition): StoryPosition {
  const page = position.trail.at(-1);
  return page === undefined ? position : { ...position, page, trail: position.trail.slice(0, -1) };
}

function moveTo(position: StoryPosition, next: string | undefined): StoryPosition | null {
  return next === undefined
    ? null
    : { ...position, page: next, trail: [...position.trail, position.page] };
}

/**
 * The page reached by a shown choice or Next, or null when the scene ends. On a choice page Next
 * takes the default, the first choice; on a question page Next is Continue.
 */
export function advance(position: StoryPosition, choice?: number): StoryPosition | null {
  const page = currentPage(position);
  if (page.choices && page.choices.length > 0) {
    const index = Math.min(Math.max(choice ?? 0, 0), page.choices.length - 1);
    return moveTo(position, page.choices[index]?.next);
  }
  const question = choice === undefined ? undefined : shownChoices(position)[choice];
  if (question?.next !== undefined) {
    const asked = moveTo(position, question.next);
    return asked && { ...asked, asked: [...position.asked, question.next] };
  }
  return moveTo(position, page.next);
}

/**
 * Skip: follows the default path (a choice page's first choice, a question page's Continue) to
 * the scene's last page. On the last page itself, it takes the default and ends the scene (null).
 */
export function skip(position: StoryPosition): StoryPosition | null {
  if (position.page === position.scene.last) {
    return advance(position);
  }
  let here: StoryPosition | null = position;
  for (let steps = 0; here && here.page !== here.scene.last; steps++) {
    if (steps > position.scene.pages.length) {
      throw new Error(`No default path to the end of ${position.scene.id}`);
    }
    here = advance(here);
  }
  return here;
}

/** A chapter's home opening: its narration and choices, each with a branch page before the story
 * rejoins as the scene ends. */
export function openingScene(content: PrototypeContent, galaxy: SectorId): Scene {
  const chapter = content.chapters[galaxy];
  return {
    effect: { galaxy, kind: "opened" },
    id: `opening:${galaxy}`,
    last: "opening:branch:0",
    lead: "home",
    pages: [
      {
        background: CHAPTER_BACKGROUNDS[galaxy].opening,
        choices: chapter.openingChoices.map((label, index) => ({
          label,
          next: `opening:branch:${index}`,
        })),
        id: "opening",
        text: chapter.opening,
      },
      ...chapter.openingBranches.map((text, index): StoryPage => ({
        background: CHAPTER_BACKGROUNDS[galaxy].opening,
        id: `opening:branch:${index}`,
        text,
      })),
    ],
  };
}

/** A chapter's home resolution: its narration and choices, each with a branch page before the
 * closing. */
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
        choices: chapter.resolutionChoices.map((label, index) => ({
          label,
          next: `resolution:branch:${index}`,
        })),
        id: "resolution",
        text: chapter.resolution,
      },
      ...chapter.resolutionBranches.map((text, index): StoryPage => ({
        background: backgrounds.resolution,
        id: `resolution:branch:${index}`,
        next: "closing",
        text,
      })),
      { background: backgrounds.closing, id: "closing", text: chapter.closing },
    ],
  };
}

/**
 * The prologue: the park where Ada finds the rock, her room as she polishes it and as it glows,
 * then the cockpit, where Astra's optional questions return to their list until Continue.
 */
export function prologueScene(content: PrototypeContent, labels: StoryLabels): Scene {
  const { prologue } = content.premise;
  const pages: StoryPage[] = [];
  prologue.forEach((step, index) => {
    const id = `prologue:${index}`;
    const following = index + 1 < prologue.length ? `prologue:${index + 1}` : undefined;
    const line = {
      background: step.background ?? "cockpit",
      ...(step.speaker ? { speaker: step.speaker } : {}),
    };
    if (step.questions) {
      pages.push({
        ...line,
        action: labels.continue,
        id,
        ...(following ? { next: following } : {}),
        questions: step.questions.map(({ question }, choice) => ({
          label: question,
          next: `${id}:answer:${choice}`,
        })),
        text: step.text,
      });
      step.questions.forEach(({ answer }, choice) => {
        pages.push({ ...line, id: `${id}:answer:${choice}`, next: id, text: answer });
      });
      return;
    }
    pages.push({
      ...line,
      id,
      ...(step.choice ? { action: step.choice } : {}),
      ...(following ? { next: following } : {}),
      text: step.text,
    });
  });
  return {
    effect: { kind: "prologue" },
    id: "prologue",
    last: pages.at(-1)?.id ?? "prologue:0",
    lead: "select",
    pages,
  };
}

/** Ada's room with the glowing rock, after a scene that leads aboard; empty visits show Penny. */
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
        text: empty ? content.premise.emptyHome : content.premise.roomRock,
      },
    ],
  };
}

/**
 * Boarding: the narration in Ada's room as she touches the glow, then Astra's line in the cockpit;
 * once after a galaxy unlocks, Astra announces it instead. Continue from the start screen lands in
 * the cockpit and plays only Astra's line.
 */
export function boardingScene(
  content: PrototypeContent,
  announce: boolean,
  fromRoom = true,
): Scene {
  const { boarding, boardingNewGalaxy } = content.premise;
  const lines = boarding.map((line, index) =>
    index === boarding.length - 1 && announce ? { ...boardingNewGalaxy, announces: true } : line,
  );
  const shown = fromRoom ? lines : lines.filter(({ speaker }) => speaker !== undefined);
  const pages = shown.map((line, index): StoryPage => ({
    ...("announces" in line ? { announces: true } : {}),
    background: line.speaker === undefined ? "adaRoom" : "cockpit",
    id: `boarding:${index}`,
    ...(index + 1 < shown.length ? { next: `boarding:${index + 1}` } : {}),
    ...(line.speaker ? { speaker: line.speaker } : {}),
    text: line.text,
  }));
  return { id: "boarding", last: `boarding:${shown.length - 1}`, lead: "select", pages };
}
