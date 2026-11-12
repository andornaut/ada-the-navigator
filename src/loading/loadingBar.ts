import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";

// The loading bar's schedule: a load of known progress fills left to right, holds full for
// fullMs, fades out over fadeMs and then goes; work of unknown total shows the travelling segment
// until it ends, then goes at once; with nothing loading there is no bar element at all.
// Foreground loads (the game's own) show over background work (the offline precache), which
// shows again once a foreground load has gone.

/** A mounted bar: the kit's DOM progress bar (web/progress/dom/progressBar). */
export interface LoadingBar {
  /** Starts or cancels the fade out after a full hold. */
  fade(fading: boolean): void;
  remove(): void;
  report(snapshot: ProgressSnapshot): void;
}

/** What the schedule needs from the page: mounting a bar and a timer for the hold and fade. */
export interface LoadingBarPort {
  clearTimeout(handle: unknown): void;
  create(): LoadingBar;
  readonly fadeMs: number;
  readonly fullMs: number;
  setTimeout(handler: () => void, ms: number): unknown;
}

/** A progress source: the kit's progress state (progressState createProgressState). */
export interface ProgressSource {
  subscribe(listener: (snapshot: ProgressSnapshot) => void): () => void;
}

const IDLE: ProgressSnapshot = { active: false, value: undefined };

/**
 * Shows the foreground and background progress through bars port creates, one at a time.
 * Returns the function that stops following and removes any bar.
 */
export function followLoading(
  port: LoadingBarPort,
  sources: { readonly background: ProgressSource; readonly foreground: ProgressSource },
): () => void {
  let foreground = IDLE;
  let background = IDLE;
  let bar: LoadingBar | undefined;
  // Whether the bar shows a measured share, which only a foreground load reports.
  let measured = false;
  // The full hold's or the fade's timer, while a finished measured load ends.
  let hold: unknown;
  let fading = false;
  const drop = () => {
    bar?.remove();
    bar = undefined;
    measured = false;
  };
  const render = (): void => {
    if (hold !== undefined) {
      // The hold and fade run out before background work shows; a new foreground load cuts them
      // short and shows on the same bar.
      if (!foreground.active) {
        return;
      }
      port.clearTimeout(hold);
      hold = undefined;
      if (fading) {
        fading = false;
        bar?.fade(false);
      }
    }
    if (bar !== undefined && measured && !foreground.active) {
      const ending = bar;
      ending.report(IDLE);
      hold = port.setTimeout(() => {
        fading = true;
        ending.fade(true);
        hold = port.setTimeout(() => {
          hold = undefined;
          fading = false;
          drop();
          render();
        }, port.fadeMs);
      }, port.fullMs);
      return;
    }
    const shown = foreground.active ? foreground : background;
    if (!shown.active) {
      drop();
      return;
    }
    bar ??= port.create();
    bar.report(shown);
    measured = shown.value !== undefined;
  };
  const stops = [
    sources.foreground.subscribe((next) => {
      foreground = next;
      render();
    }),
    sources.background.subscribe((next) => {
      background = next;
      render();
    }),
  ];
  return () => {
    for (const stop of stops) {
      stop();
    }
    if (hold !== undefined) {
      port.clearTimeout(hold);
      hold = undefined;
    }
    drop();
  };
}

/** The loader events trackLoader follows: Phaser's LoaderPlugin. */
export interface LoaderLike {
  on(event: "complete" | "progress" | "start", listener: (value?: unknown) => void): unknown;
}

/** A progress state's operations (progressState createProgressState). */
export interface ProgressOperations {
  begin(): { finish(): void; progress(value: number | undefined): void };
}

/**
 * Reports each run of loader to state as a measured load: from its start, its share of files
 * loaded, never moving back when a run queues more files as it goes, until it completes.
 */
export function trackLoader(state: ProgressOperations, loader: LoaderLike): void {
  let run: ReturnType<ProgressOperations["begin"]> | undefined;
  let share = 0;
  loader.on("start", () => {
    run = state.begin();
    share = 0;
    run.progress(share);
  });
  loader.on("progress", (value) => {
    if (run !== undefined && typeof value === "number" && Number.isFinite(value)) {
      share = Math.max(share, value);
      run.progress(share);
    }
  });
  loader.on("complete", () => {
    run?.progress(1);
    run?.finish();
    run = undefined;
  });
}
