import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";

// The loading bar's schedule: a load of known progress fills left to right, holds full for
// fullMs, fades out over fadeMs and then goes; work of unknown total shows the travelling segment
// until it ends, then goes at once; with nothing loading there is no bar element at all.
// Foreground loads (the game's own) show over background work (the offline precache), which
// shows again once a foreground load has gone.

/** A mounted bar: the kit's DOM progress bar (web/progress/dom/progressBar), which shows a
 * finished measured load full for fullMs, then fades it out over fadeMs. */
export interface LoadingBar {
  remove(): void;
  report(snapshot: ProgressSnapshot): void;
}

/** What the schedule needs from the page: mounting a bar and a timer for its hold and fade. */
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
  // The hold and fade's timer, while a finished measured load ends.
  let hold: unknown;
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
    }
    if (bar !== undefined && measured && !foreground.active) {
      // The kit's complete state: full for the hold, then fading; removed once the fade ends.
      bar.report(IDLE);
      hold = port.setTimeout(() => {
        hold = undefined;
        drop();
        render();
      }, port.fullMs + port.fadeMs);
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

/** The loader trackLoader follows: Phaser's LoaderPlugin, its events and its state. */
export interface LoaderLike {
  isLoading(): boolean;
  on(event: "complete" | "progress" | "start", listener: (value?: unknown) => void): unknown;
  readonly progress: number;
}

/** A progress state's operations (progressState createProgressState). */
export interface ProgressOperations {
  begin(): { finish(): void; progress(value: number | undefined): void };
}

/**
 * The loads the player waits for, which alone show the bar: the boot preload before the first
 * screen, and a galaxy's own art as its first flight starts. On-demand art during play (scenery,
 * rocks, ship parts, paint) loads silently. The precache is the background source.
 */
export type WaitedLoad = "boot" | "galaxy";

/** Marks loader runs the player waits for. */
export interface LoadTracker {
  /**
   * Shows the loader's next run as load, from its start; or, while a silent run is under way
   * that load's files join, that run from its share so far.
   */
  waitFor(load: WaitedLoad): void;
}

/**
 * Reports each run of loader that waitFor marked to state as a measured load: from its start,
 * its share of files loaded, never moving back when a run queues more files as it goes, until it
 * completes. Every other run reports nothing.
 */
export function trackLoader(state: ProgressOperations, loader: LoaderLike): LoadTracker {
  let run: ReturnType<ProgressOperations["begin"]> | undefined;
  let waiting: WaitedLoad | undefined;
  let share = 0;
  const begin = (from: number) => {
    run = state.begin();
    share = from;
    run.progress(share);
  };
  loader.on("start", () => {
    if (waiting !== undefined) {
      waiting = undefined;
      begin(0);
    }
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
  return {
    waitFor(load) {
      if (run !== undefined) {
        return;
      }
      if (loader.isLoading()) {
        begin(Number.isFinite(loader.progress) ? loader.progress : 0);
      } else {
        waiting = load;
      }
    },
  };
}
