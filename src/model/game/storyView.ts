import type { StoryRun, StoryView } from "../game.ts";
import {
  canGoBack,
  currentPage,
  type Scene,
  shownChoices,
  showsStoryNext,
  type StoryChoice,
  type StoryPage,
  type StoryPosition,
} from "../storybook.ts";

interface StoryViewContext {
  readonly canSkip: (page: StoryPage) => boolean;
  readonly choosingReplay: () => boolean;
  readonly label: (key: string) => string;
  readonly replayChoices: () => readonly StoryChoice[];
  readonly roomHasReplays: () => boolean;
  readonly run: () => StoryRun;
}

/** The current page and its navigation affordances, with replay lookups deferred to use. */
export function projectStoryView(context: StoryViewContext, position: StoryPosition): StoryView {
  const page = currentPage(position);
  if (context.choosingReplay()) {
    const choices = context.replayChoices();
    return {
      canGoBack: true,
      canSkip: false,
      choices,
      page: {
        background: page.background,
        choices,
        heading: context.label("replayChapter"),
        id: "replay-menu",
        previousAction: context.label("questBack"),
        text: "",
      },
      run: context.run(),
    };
  }
  return {
    canGoBack: canGoBack(position),
    canSkip: context.canSkip(page),
    choices: context.roomHasReplays()
      ? [{ label: context.label("replayChapter") }]
      : shownChoices(position),
    page,
    run: context.run(),
  };
}

export function storyPageCanSkip(
  playedInterlude: (scene: Scene) => boolean,
  runScenes: () => readonly Scene[],
  position: StoryPosition,
  page: StoryPage,
): boolean {
  if (!showsStoryNext(page)) {
    return false;
  }
  const { scene } = position;
  if (page.next !== undefined) {
    const next = scene.pages.find(({ id }) => id === page.next);
    const following =
      next?.sleep && playedInterlude(scene) ? scene.pages.find(({ id }) => id === next.next) : next;
    return following !== undefined && showsStoryNext(following);
  }
  // The run preview is built through the same scene transitions as Next.
  const index = runScenes().findIndex(({ id }) => id === scene.id);
  const following = index < 0 ? undefined : runScenes()[index + 1]?.pages[0];
  return following !== undefined && showsStoryNext(following);
}

export function storyRoomPage(
  isStoryScreen: () => boolean,
  choosingReplay: boolean,
  position: StoryPosition | null,
): boolean {
  return (
    !choosingReplay && position !== null && isStoryScreen() && currentPage(position).id === "room"
  );
}
