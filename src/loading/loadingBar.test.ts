import {
  createProgressDisplay,
  createProgressState,
  type ProgressSnapshot,
} from "@andornaut/game-kit/progressState";
import { describe, expect, it } from "vitest";

import { LOADING_BAR } from "../ui/loading-bar.ts";
import { followLoading, type LoaderLike, trackLoader } from "./loadingBar.ts";
import { BAR_STYLE, BAR_TIMING } from "./progress.ts";

const { fadeMs: FADE_MS, fullMs: FULL_MS } = LOADING_BAR;

/** A page whose bars record what they show, with a clock the test advances. */
function page() {
  const bars: { removed: boolean; shown: ProgressSnapshot[] }[] = [];
  let now = 0;
  const timers = new Map<number, { at: number; handler: () => void }>();
  let next = 0;
  const port = {
    clearTimeout: (handle: unknown) => timers.delete(handle as number),
    create: () => {
      const bar = { removed: false, shown: [] as ProgressSnapshot[] };
      bars.push(bar);
      return {
        remove: () => (bar.removed = true),
        report: (s: ProgressSnapshot) => bar.shown.push(s),
      };
    },
    fadeMs: FADE_MS,
    fullMs: FULL_MS,
    setTimeout: (handler: () => void, ms: number) => {
      next += 1;
      timers.set(next, { at: now + ms, handler });
      return next;
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [handle, timer] of [...timers]) {
      if (timer.at <= now) {
        timers.delete(handle);
        timer.handler();
      }
    }
  };
  // The bars still mounted.
  const mounted = () => bars.filter((bar) => !bar.removed);
  return { advance, bars, mounted, port };
}

function loading() {
  const view = page();
  const foreground = createProgressState();
  const background = createProgressState();
  followLoading(view.port, { background, foreground });
  return { background, foreground, ...view };
}

describe("the loading bar", () => {
  it("mounts no bar element while nothing loads", () => {
    const { bars } = loading();
    expect(bars).toHaveLength(0);
  });

  it("fills a measured load to full, holds it, fades it out, then removes the element", () => {
    const { advance, bars, foreground, mounted } = loading();
    const load = foreground.begin();
    load.progress(0.4);
    load.progress(1);
    expect(mounted()).toHaveLength(1);
    expect(bars[0]!.shown.at(-1)).toEqual({ active: true, value: 1 });
    load.finish();
    // The kit's bar shows complete: full for the hold, then fading.
    expect(bars[0]!.shown.at(-1)).toEqual({ active: false, value: undefined });
    advance(FULL_MS + FADE_MS - 1);
    expect(mounted()).toHaveLength(1);
    advance(1);
    expect(mounted()).toHaveLength(0);
  });

  it("has the kit draw a finished load full for 250 ms, then fade it out over 150 ms", () => {
    expect(BAR_TIMING).toEqual({ cycleMs: 1500, fadeMs: 150, fullMs: 250, segment: 0.3 });
    // The kit's own timeline for that timing, which progressBar.css draws.
    const display = createProgressDisplay(BAR_TIMING.fullMs, BAR_TIMING.fadeMs);
    display.report({ active: true, value: 1 });
    display.report({ active: false, value: undefined });
    expect(display.at(0)).toEqual({ kind: "measured", value: 1 });
    expect(display.at(FULL_MS - 1)).toEqual({ kind: "measured", value: 1 });
    expect(display.at(FULL_MS + FADE_MS / 2)).toEqual({ kind: "measured", opacity: 0.5, value: 1 });
    expect(display.at(FULL_MS + FADE_MS)).toEqual({ kind: "hidden" });
  });

  it("sets Art's look: cream on ink at 0.6 over an ink rule, a 250 ms hold, a 150 ms fade", () => {
    expect(LOADING_BAR).toEqual({
      fadeMs: 150,
      fill: "#ead4aa",
      fillHeight: 2,
      fullMs: 250,
      height: 3,
      rule: "#181425",
      ruleHeight: 1,
      segment: 0.3,
      track: "#181425",
      trackAlpha: 0.6,
    });
    // The 2 high band over the 1 high rule: 3 in all.
    expect(LOADING_BAR.fillHeight + LOADING_BAR.ruleHeight).toBe(LOADING_BAR.height);
    // The kit draws the alphas: no frame, the ink track at 0.6 under the cream fill.
    expect(BAR_STYLE).toEqual({
      border: 0,
      fills: [0xead4aa],
      frame: 0x181425,
      frameAlpha: 0,
      track: 0x181425,
      trackAlpha: 0.6,
    });
  });

  it("shows work of unknown total as the travelling segment, removed as soon as it ends", () => {
    const { background, bars, mounted } = loading();
    const install = background.begin();
    expect(mounted()).toHaveLength(1);
    // An active report with no share is the kit's pending state, whose segment travels.
    expect(bars[0]!.shown).toEqual([{ active: true, value: undefined }]);
    install.finish();
    expect(mounted()).toHaveLength(0);
  });

  it("shows a game load over the precache, holds it full, then the precache again", () => {
    const { advance, background, bars, foreground, mounted } = loading();
    const install = background.begin();
    const load = foreground.begin();
    load.progress(0.5);
    expect(bars[0]!.shown.at(-1)).toEqual({ active: true, value: 0.5 });
    load.finish();
    advance(FULL_MS + FADE_MS);
    expect(mounted()).toHaveLength(1);
    expect(mounted()[0]!.shown).toEqual([{ active: true, value: undefined }]);
    install.finish();
    expect(mounted()).toHaveLength(0);
  });

  it("lets a new load cut a fade short and fill the same bar again", () => {
    const { advance, bars, foreground, mounted } = loading();
    const first = foreground.begin();
    first.progress(1);
    first.finish();
    // Midway through the fade.
    advance(FULL_MS + FADE_MS / 2);
    const second = foreground.begin();
    second.progress(0.2);
    advance(FULL_MS + FADE_MS);
    expect(mounted()).toHaveLength(1);
    expect(bars).toHaveLength(1);
    expect(bars[0]!.shown.at(-1)).toEqual({ active: true, value: 0.2 });
  });
});

describe("tracking the loader", () => {
  function loader() {
    const listeners = new Map<string, (value?: unknown) => void>();
    const fake: LoaderLike & { loading: boolean; progress: number } = {
      isLoading(): boolean {
        return fake.loading;
      },
      loading: false,
      on: (event, listener) => listeners.set(event, listener),
      progress: 0,
    };
    // Starts, reports and completes a run as Phaser's loader does.
    const emit = (event: string, value?: unknown) => {
      fake.loading = event !== "complete";
      listeners.get(event)?.(value);
    };
    return { emit, fake };
  }
  function tracked() {
    const state = createProgressState();
    const seen: [boolean, number | undefined][] = [];
    state.subscribe(({ active, value }) => seen.push([active, value]));
    const { emit, fake } = loader();
    const loads = trackLoader(state, fake);
    return { emit, fake, loads, seen, state };
  }

  it("reports a waited-for run from its start to full, never moving back as files queue", () => {
    const { emit, loads, seen } = tracked();
    loads.waitFor("boot");
    emit("start");
    emit("progress", 0.6);
    // A galaxy manifest queues its art mid-run, so the share of files loaded drops.
    emit("progress", 0.3);
    emit("complete");
    expect(seen).toEqual([
      [false, undefined],
      [true, undefined],
      [true, 0],
      [true, 0.6],
      [true, 1],
      [false, undefined],
    ]);
  });

  it("shows the boot preload and a galaxy's entry, and reports nothing for on-demand runs", () => {
    const { emit, loads, seen } = tracked();
    loads.waitFor("boot");
    emit("start");
    emit("complete");
    const shown = seen.length;
    // On-demand art during play: scenery, rocks, ship parts.
    for (let run = 0; run < 3; run++) {
      emit("start");
      emit("progress", 0.5);
      emit("complete");
    }
    expect(seen).toHaveLength(shown);
    loads.waitFor("galaxy");
    emit("start");
    emit("complete");
    expect(seen.slice(shown)).toEqual([
      [true, undefined],
      [true, 0],
      [true, 1],
      [false, undefined],
    ]);
  });

  it("shows a silent run a galaxy's entry joins, from its share so far", () => {
    const { emit, fake, loads, seen } = tracked();
    emit("start");
    fake.progress = 0.4;
    emit("progress", 0.4);
    loads.waitFor("galaxy");
    emit("progress", 0.7);
    emit("complete");
    expect(seen).toEqual([
      [false, undefined],
      [true, undefined],
      [true, 0.4],
      [true, 0.7],
      [true, 1],
      [false, undefined],
    ]);
  });

  it("mounts no bar for an on-demand load during flight", () => {
    const { advance, bars, foreground } = loading();
    const { emit, fake } = loader();
    trackLoader(foreground, fake);
    emit("start");
    emit("progress", 0.5);
    emit("complete");
    advance(FULL_MS + FADE_MS);
    expect(bars).toHaveLength(0);
  });

  it("ignores a complete with no run, as for an empty queue", () => {
    const { emit, seen } = tracked();
    emit("complete");
    expect(seen).toEqual([[false, undefined]]);
  });
});
