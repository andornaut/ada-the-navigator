import { type Background, CHAPTER_BACKGROUNDS } from "../data/storybook.ts";
import type { ChapterContent, GalaxyNumber, GameContent, PrologueStep } from "../data/types.ts";

/** A choice and the page it leads to; without one, the choice ends the scene. */
export interface StoryChoice {
  readonly label: string;
  readonly next?: string;
}
/** One storybook page: a location background with its text or dialogue panel. */
export interface StoryPage {
  readonly id: string;
  readonly background: Background;
  /** The chapter's panel title heading the text, on opening, resolution and closing pages. */
  readonly heading?: string;
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
  /**
   * The overnight recharge's sleep scene: no panel, moving on by itself after OVERNIGHT_SLEEP's
   * seconds, or at a tap once its skip delay has passed.
   */
  readonly sleep?: boolean;
  /** The holodisk's insertion into Astra's drive, where Art's holodisk sequence plays. */
  readonly holodisk?: boolean;
}
export type SceneEffect =
  | { readonly kind: "opened"; readonly galaxy: GalaxyNumber }
  | { readonly kind: "prologue" }
  | { readonly kind: "resolved"; readonly galaxy: GalaxyNumber };
/**
 * What follows a scene: more Earth scenes (`visit` arrives home as any visit does, waiting scenes
 * first), boarding aboard, galaxy selection, or the flight the scene paused.
 */
export type SceneLead = "home" | "board" | "flight" | "select" | "visit";
export interface Scene {
  readonly id: string;
  /** In reading order; the first page opens the scene. */
  readonly pages: readonly StoryPage[];
  /** The scene's last page, where Skip arrives. */
  readonly last: string;
  /** Applied when the scene ends. */
  readonly effect?: SceneEffect;
  readonly lead: SceneLead;
  /**
   * The story run ends on this scene's last page, where play resumes (Ada's room with its named
   * action): Skip stops there and hides on it, and the scene it leads to starts a new run.
   */
  readonly endsRun?: boolean;
}
/** A page shown earlier in the story run: its scene, its id and the questions asked by then. */
export interface StoryStep {
  readonly asked: readonly string[];
  readonly page: string;
  readonly scene: Scene;
}
/**
 * A place in a story run: the page on show, with the questions asked in its scene and the pages
 * shown before it in the run, across scene boundaries, for Previous.
 */
export interface StoryPosition extends StoryStep {
  readonly trail: readonly StoryStep[];
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

/** The page a position shows, as a step of the run's trail. */
export function stepOf(position: StoryPosition): StoryStep {
  return { asked: position.asked, page: position.page, scene: position.scene };
}

/**
 * A scene's first page. `trail` holds the run's pages shown before it: empty when the scene
 * starts a run, so Previous is disabled there.
 */
export function storyStart(scene: Scene, trail: readonly StoryStep[] = []): StoryPosition {
  const first = scene.pages[0];
  if (!first) {
    throw new Error(`Empty scene ${scene.id}`);
  }
  return { asked: [], page: first.id, scene, trail };
}

/**
 * The trail the scene after this position's continues. Past a run's end the next run starts on
 * this page, whose named action began it, so Previous on the next page returns here.
 */
export function runTrail(position: StoryPosition): readonly StoryStep[] {
  return position.scene.endsRun ? [stepOf(position)] : [...position.trail, stepOf(position)];
}

/** A trail step's page. */
export function stepPage(step: StoryStep): StoryPage {
  return lookup(step.scene, step.page);
}

/** Previous is disabled only on the story run's first page. */
export function canGoBack(position: StoryPosition): boolean {
  return position.trail.length > 0;
}

/** The page shown before, in this scene or an earlier one of the run. */
export function goBack(position: StoryPosition): StoryPosition {
  const step = position.trail.at(-1);
  return step === undefined ? position : { ...step, trail: position.trail.slice(0, -1) };
}

/** Whether the run ends on this page: the last page of a scene that ends it. */
export function atRunEnd(position: StoryPosition): boolean {
  return Boolean(position.scene.endsRun) && position.page === position.scene.last;
}

/**
 * Whether Skip would pass a page: the page Next or the named action shows next, by the default
 * path, is not the run's end, which is where Skip lands. `scenes` are the run's scenes in the
 * order it chains them, so the last page of one leads to the first of the next.
 */
export function skipPassesPage(scenes: readonly Scene[], position: StoryPosition): boolean {
  if (atRunEnd(position)) {
    return false;
  }
  const next = advance(position);
  if (next) {
    return !atRunEnd(next);
  }
  const following = scenes[scenes.findIndex((scene) => scene.id === position.scene.id) + 1];
  return following !== undefined && !atRunEnd(storyStart(following));
}

function moveTo(position: StoryPosition, next: string | undefined): StoryPosition | null {
  return next === undefined
    ? null
    : { ...position, page: next, trail: [...position.trail, stepOf(position)] };
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
 * The scene's last page by the default path (a choice page's first choice, a question page's
 * Continue, no optional question asked).
 */
export function sceneEnd(position: StoryPosition): StoryPosition {
  let here = position;
  for (let steps = 0; here.page !== here.scene.last; steps++) {
    const next = advance(here);
    if (!next || steps > position.scene.pages.length) {
      throw new Error(`No default path to the end of ${position.scene.id}`);
    }
    here = next;
  }
  return here;
}

/** A premise line as a page, at its own background or the scene's. */
function linePage(
  background: Background,
  id: string,
  next: string | undefined,
  step: PrologueStep,
): StoryPage {
  return {
    background: step.background ?? background,
    id,
    ...(next ? { next } : {}),
    ...(step.speaker ? { speaker: step.speaker } : {}),
    text: step.text,
  };
}

/** A built galaxy's chapter and Earth scenes; a placeholder galaxy has none to play. */
function builtChapter(
  content: GameContent,
  galaxy: GalaxyNumber,
): [ChapterContent, NonNullable<(typeof CHAPTER_BACKGROUNDS)[GalaxyNumber]>] {
  const chapter = content.chapters[galaxy];
  const backgrounds = CHAPTER_BACKGROUNDS[galaxy];
  if (!chapter || !backgrounds) {
    throw new RangeError(`Galaxy ${galaxy} has no chapter`);
  }
  return [chapter, backgrounds];
}

/**
 * A chapter's home opening: its narration and choices, each with a branch page before the story
 * rejoins as the scene ends. On the first launch, chapter one's opening is framed by Grandma's
 * garden: the arrival pages before it and her farewell after the branch.
 */
export function openingScene(
  content: GameContent,
  galaxy: GalaxyNumber,
  firstLaunch = false,
): Scene {
  const [chapter, { opening: background }] = builtChapter(content, galaxy);
  const framed = firstLaunch && galaxy === 1;
  const arrival = framed ? content.premise.gardenArrival : [];
  const arrivalPages = arrival.map((step, index) =>
    linePage(
      background,
      `opening:arrival:${index}`,
      index + 1 < arrival.length ? `opening:arrival:${index + 1}` : "opening",
      step,
    ),
  );
  const farewell = framed ? "opening:farewell" : undefined;
  // Either branch rejoins on the chapter's rejoin pages (Cartwheel's dinner), then the farewell.
  const rejoin = chapter.openingRejoin ?? [];
  const rejoinIds = rejoin.map((_, index) => `opening:rejoin:${index}`);
  const after = [...rejoinIds, ...(farewell ? [farewell] : [])];
  return {
    effect: { galaxy, kind: "opened" },
    id: `opening:${galaxy}`,
    last: after.at(-1) ?? "opening:branch:0",
    lead: "home",
    pages: [
      ...arrivalPages,
      {
        background,
        choices: chapter.openingChoices.map((label, index) => ({
          label,
          next: `opening:branch:${index}`,
        })),
        heading: chapter.name,
        id: "opening",
        text: chapter.opening,
      },
      ...chapter.openingBranches.map((text, index): StoryPage => ({
        background,
        id: `opening:branch:${index}`,
        ...(after[0] ? { next: after[0] } : {}),
        text,
      })),
      ...rejoin.map((step, index) =>
        linePage(background, rejoinIds[index]!, after[index + 1], step),
      ),
      ...(farewell
        ? [linePage(background, farewell, undefined, content.premise.gardenFarewell)]
        : []),
    ],
  };
}

/** A chapter's home resolution: its narration and choices, each with a branch page before the
 * closing. */
export function resolutionScene(content: GameContent, galaxy: GalaxyNumber): Scene {
  const [chapter, backgrounds] = builtChapter(content, galaxy);
  const rejoin = chapter.resolutionRejoin ?? [];
  const closing = chapter.closingLines ?? [];
  return {
    effect: { galaxy, kind: "resolved" },
    id: `resolution:${galaxy}`,
    last: closing.length ? `closing:${closing.length - 1}` : "closing",
    lead: "home",
    pages: [
      {
        background: backgrounds.resolution,
        choices: chapter.resolutionChoices.map((label, index) => ({
          label,
          next: `resolution:branch:${index}`,
        })),
        heading: chapter.name,
        id: "resolution",
        text: chapter.resolution,
      },
      ...chapter.resolutionBranches.map((text, index): StoryPage => ({
        background: backgrounds.resolution,
        id: `resolution:branch:${index}`,
        next: rejoin.length ? "resolution:rejoin:0" : "closing",
        text,
      })),
      ...rejoin.map((line, index): StoryPage => ({
        ...line,
        background: backgrounds.resolution,
        id: `resolution:rejoin:${index}`,
        next: index + 1 < rejoin.length ? `resolution:rejoin:${index + 1}` : "closing",
      })),
      {
        background: backgrounds.closing,
        heading: chapter.name,
        id: "closing",
        ...(closing.length ? { next: "closing:0" } : {}),
        text: chapter.closing,
      },
      ...closing.map((line, index): StoryPage => ({
        ...line,
        background: backgrounds.closing,
        id: `closing:${index}`,
        ...(index + 1 < closing.length ? { next: `closing:${index + 1}` } : {}),
      })),
    ],
  };
}

/**
 * The prologue: the park where Ada finds the rock, her room as she polishes it and as it glows,
 * then aboard, where Astra's optional questions return to their list until Continue.
 */
export function prologueScene(content: GameContent, labels: StoryLabels): Scene {
  const { prologue } = content.premise;
  const pages: StoryPage[] = [];
  prologue.forEach((step, index) => {
    const id = `prologue:${index}`;
    const following = index + 1 < prologue.length ? `prologue:${index + 1}` : undefined;
    const line = {
      background: step.background ?? "aboard",
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

/**
 * The holodisk moment aboard, paused over the flight (gameplay/rules.md): the insertion lines,
 * Art's holodisk sequence playing on the first, then Astra's memory line for how many holodisks
 * she now holds; the flight resumes after it.
 */
export function holodiskScene(
  inserted: readonly { readonly speaker?: string; readonly text: string }[],
  memory: string,
): Scene {
  const lines = [...inserted, { speaker: inserted.at(-1)?.speaker, text: memory }];
  const ids = lines.map((_, index) =>
    index < inserted.length ? `holodisk:${index}` : "holodisk:memory",
  );
  return {
    id: "holodisk",
    last: "holodisk:memory",
    lead: "flight",
    pages: lines.map((line, index): StoryPage => ({
      background: "aboard",
      ...(index === 0 ? { holodisk: true } : {}),
      id: ids[index]!,
      ...(index + 1 < lines.length ? { next: ids[index + 1] } : {}),
      ...(line.speaker ? { speaker: line.speaker } : {}),
      text: line.text,
    })),
  };
}

/**
 * The emergency jump's overnight recharge: the jump-home line aboard in the emergency jump's red,
 * the sleep scene in Ada's room, then morning with its narration; the visit's waiting scenes
 * follow.
 */
export function jumpHomeScene(jumpHome: string, morning: string): Scene {
  return {
    id: "jumpHome",
    last: "morning",
    lead: "visit",
    pages: [
      { background: "aboardEmergency", id: "jumpHome", next: "sleep", text: jumpHome },
      { background: "adaRoomSleep", id: "sleep", next: "morning", sleep: true, text: "" },
      { background: "adaRoomMorningCats", id: "morning", text: morning },
    ],
  };
}

/** Ada's room with the glowing rock, after a scene that leads aboard; empty visits show Penny. */
export function roomScene(content: GameContent, labels: StoryLabels, empty: boolean): Scene {
  return {
    endsRun: true,
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
 * Boarding, after Ada's room page: the narration as she touches the glow, then Astra's line
 * aboard; once after a galaxy unlocks, Astra announces it instead.
 */
export function boardingScene(content: GameContent, announce: boolean): Scene {
  const { boarding, boardingNewGalaxy } = content.premise;
  const shown = boarding.map((line, index) =>
    index === boarding.length - 1 && announce ? { ...boardingNewGalaxy, announces: true } : line,
  );
  const pages = shown.map((line, index): StoryPage => ({
    ...("announces" in line ? { announces: true } : {}),
    background: line.speaker === undefined ? "adaRoom" : "aboard",
    id: `boarding:${index}`,
    ...(index + 1 < shown.length ? { next: `boarding:${index + 1}` } : {}),
    ...(line.speaker ? { speaker: line.speaker } : {}),
    text: line.text,
  }));
  return { id: "boarding", last: `boarding:${shown.length - 1}`, lead: "select", pages };
}
