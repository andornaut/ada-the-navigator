import { LOADER_CONFIG } from "@andornaut/game-kit/load/loaderConfig";
import { startOfflinePlay } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { PENDING_ATTRIBUTE } from "@andornaut/game-kit/web/ui/dom/imageReady";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prepareBootReveal } from "./bootReveal.ts";
import { loadingProgress } from "./progress.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

async function settle() {
  for (let turn = 0; turn < 20; turn++) {
    // Each microtask turn advances the kit's decode and reveal promise chain.
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function fixture() {
  const images = new Map<string, ReturnType<typeof deferred<void>>>();
  const attributes = new Map<string, string>();
  const frames = new Map<number, FrameRequestCallback>();
  const manifest = deferred<Response>();
  const title = {
    currentSrc: "",
    src: "https://game.test/art/title.svg",
    tagName: "IMG",
  };
  const root = {
    querySelectorAll: () => [title],
    removeAttribute: (key: string) => attributes.delete(key),
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    tagName: "DIV",
  } as unknown as HTMLElement;
  const splash = { remove: vi.fn() };
  const document = {
    baseURI: "https://game.test/play/",
    createElement: () => {
      const image = {
        decode: () => {
          const pending = deferred<void>();
          images.set(image.src, pending);
          return pending.promise;
        },
        src: "",
      };
      return image;
    },
    getElementById: () => splash,
  } as unknown as Document;
  let nextFrame = 0;
  const window = {
    cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
    clearTimeout: (id?: number) => globalThis.clearTimeout(id),
    fetch: vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return manifest.promise;
    }),
    getComputedStyle: vi.fn(
      () =>
        ({
          backgroundImage: "url('/art/field.svg')",
          borderImageSource: 'url("/art/ui/sprites/card.png")',
        }) as CSSStyleDeclaration,
    ),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }),
    setTimeout: (handler: TimerHandler, timeout?: number) =>
      globalThis.setTimeout(handler as () => void, timeout) as unknown as number,
  };
  const revealed = vi.fn();
  const boot = prepareBootReveal({ document, window }, root, revealed);
  const manifestReady = () =>
    manifest.resolve({
      json: async () => ({ sprites: [{ png: "sprites/card.png" }] }),
      ok: true,
    } as Response);
  const paint = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  };
  return {
    attributes,
    boot,
    document,
    frames,
    images,
    manifest,
    manifestReady,
    paint,
    revealed,
    root,
    splash,
    window,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("boot image readiness", () => {
  it("predecodes card sheets, waits for scene and title art, then reveals before notification", async () => {
    const active: boolean[] = [];
    const stop = loadingProgress.subscribe((snapshot) => active.push(snapshot.active));
    const f = fixture();
    expect(active.at(-1)).toBe(true);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    f.manifestReady();
    await settle();
    expect([...f.images.keys()]).toEqual(["https://game.test/art/ui/sprites/card.png"]);
    f.images.values().next().value!.resolve();
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    expect(f.window.getComputedStyle).not.toHaveBeenCalled();
    f.boot.ready();
    await settle();
    expect([...f.images.keys()].sort()).toEqual([
      "https://game.test/art/field.svg",
      "https://game.test/art/title.svg",
      "https://game.test/art/ui/sprites/card.png",
    ]);
    f.images.get("https://game.test/art/field.svg")!.resolve();
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    f.images.get("https://game.test/art/title.svg")!.resolve();
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    expect(f.splash.remove).toHaveBeenCalledOnce();
    expect(active.at(-1)).toBe(false);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.revealed).not.toHaveBeenCalled();
    f.paint();
    expect(f.revealed).not.toHaveBeenCalled();
    f.paint();
    expect(f.revealed).toHaveBeenCalledOnce();
    f.boot.ready();
    f.paint();
    expect(f.revealed).toHaveBeenCalledOnce();
    f.boot.dispose();
  });

  it("keeps real pending progress during image decoding after the measured loader finishes", async () => {
    const snapshots: boolean[] = [];
    const stop = loadingProgress.subscribe((snapshot) => snapshots.push(snapshot.active));
    const f = fixture();
    const loader = loadingProgress.begin();
    loader.progress(1);
    loader.finish();
    expect(snapshots.at(-1)).toBe(false);
    f.boot.ready();
    expect(snapshots.at(-1)).toBe(true);
    expect(f.splash.remove).not.toHaveBeenCalled();
    f.boot.dispose();
    await settle();
    stop();
  });

  it.each(["http", "network", "json"])(
    "reveals fallback art after a manifest %s error and failed image decodes",
    async (failure) => {
      const f = fixture();
      f.boot.ready();
      if (failure === "network") {
        f.manifest.reject(new Error("offline"));
      } else {
        f.manifest.resolve({
          json: async () => {
            throw new Error("invalid manifest");
          },
          ok: failure !== "http",
        } as unknown as Response);
      }
      await settle();
      for (const image of f.images.values()) {
        image.reject(new Error("missing image"));
      }
      await settle();
      expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
      f.paint();
      f.paint();
      expect(f.revealed).toHaveBeenCalledOnce();
      f.boot.dispose();
    },
  );

  it("aborts manifest work and cancels a pending reveal without late decoding or notification", async () => {
    const f = fixture();
    const signal = f.window.fetch.mock.calls[0]![1]!.signal!;
    f.boot.dispose();
    f.boot.dispose();
    expect(signal.aborted).toBe(true);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    f.manifestReady();
    await settle();
    expect(f.images.size).toBe(0);
    expect(f.window.getComputedStyle).not.toHaveBeenCalled();
    expect(f.frames.size).toBe(0);
    expect(f.revealed).not.toHaveBeenCalled();
  });

  it.each([0, 1])("cleans up after reveal with %s paint callbacks completed", async (paints) => {
    const f = fixture();
    f.manifestReady();
    f.boot.ready();
    await settle();
    f.images.forEach((image) => image.resolve());
    await settle();
    for (let i = 0; i < paints; i++) {
      f.paint();
    }
    f.boot.dispose();
    expect(f.window.cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(f.frames.size).toBe(0);
    f.paint();
    expect(f.revealed).not.toHaveBeenCalled();
  });

  it("cancels while decoding without notifying after the last image settles", async () => {
    const f = fixture();
    f.manifestReady();
    f.boot.ready();
    await settle();
    f.boot.dispose();
    f.images.forEach((image) => image.resolve());
    await settle();
    expect(f.frames.size).toBe(0);
    expect(f.revealed).not.toHaveBeenCalled();
  });

  it("bounds a manifest that ignores abort, then bounds stalled decodes and ignores stale completion", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const active: boolean[] = [];
    const stop = loadingProgress.subscribe((value) => active.push(value.active));
    const f = fixture();
    const signal = f.window.fetch.mock.calls[0]![1]!.signal!;
    f.boot.ready();
    await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout - 1);
    expect(signal.aborted).toBe(false);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(f.images.has("https://game.test/art/title.svg")).toBe(true);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    expect(f.revealed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout - 1);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    expect(active.at(-1)).toBe(false);
    expect(warning).toHaveBeenCalledTimes(2);
    f.paint();
    expect(f.revealed).not.toHaveBeenCalled();
    f.paint();
    expect(f.revealed).toHaveBeenCalledOnce();
    const decoded = [...f.images.keys()];
    f.manifestReady();
    f.images.forEach((image) => image.resolve());
    await settle();
    expect([...f.images.keys()]).toEqual(decoded);
    f.paint();
    expect(f.revealed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    f.boot.dispose();
    stop();
  });

  it("bounds a stalled response body without revealing before scene creation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fixture();
    const body = deferred<{ sprites: { png: string }[] }>();
    const signal = f.window.fetch.mock.calls[0]![1]!.signal!;
    f.manifest.resolve({ json: () => body.promise, ok: true } as unknown as Response);
    await settle();
    await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout);
    expect(signal.aborted).toBe(true);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    expect(f.images.size).toBe(0);
    body.resolve({ sprites: [{ png: "stale.png" }] });
    await settle();
    expect(f.images.size).toBe(0);
    f.boot.ready();
    await settle();
    f.images.forEach((image) => image.resolve());
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    f.paint();
    f.paint();
    expect(f.revealed).toHaveBeenCalledOnce();
    f.boot.dispose();
  });

  it("cleans up a never-settling manifest without timeout fallback or late registration", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fixture();
    const signal = f.window.fetch.mock.calls[0]![1]!.signal!;
    f.boot.ready();
    f.boot.dispose();
    await settle();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout * 3);
    expect(warning).not.toHaveBeenCalled();
    expect(f.images.size).toBe(0);
    expect(f.frames.size).toBe(0);
    expect(f.revealed).not.toHaveBeenCalled();
  });

  it("cleans up after decode timeout before paint and suppresses its registration", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fixture();
    f.manifestReady();
    f.boot.ready();
    await settle();
    await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout);
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    f.boot.dispose();
    f.images.forEach((image) => image.resolve());
    await settle();
    f.paint();
    f.paint();
    expect(f.revealed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a controlled newer-save update independent of blocked boot art", async () => {
    const f = fixture();
    const postMessage = vi.fn();
    const waiting = Object.assign(new EventTarget(), { postMessage, state: "installed" });
    const registration = Object.assign(new EventTarget(), {
      active: Object.assign(new EventTarget(), { postMessage: vi.fn(), state: "activated" }),
      installing: null,
      update: vi.fn(async () => {}),
      waiting,
    });
    const register = vi.fn(async () => registration);
    const container = Object.assign(new EventTarget(), {
      controller: {} as unknown,
      getRegistration: async () => undefined,
      register,
    });
    const reload = vi.fn();
    const onRequireNewer = vi.fn();
    const play = startOfflinePlay(
      { onRequireNewer, onUpdateShown: vi.fn(), serviceWorkerUrl: "/sw.js" },
      {
        container,
        eventTarget: new EventTarget(),
        now: () => 0,
        online: () => true,
        reload,
        session: undefined,
        visibilitySource: Object.assign(new EventTarget(), { visibilityState: "visible" as const }),
      },
    );
    await play.launchReady();
    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js", { scope: "/" });
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    play.flow.requireNewer();
    expect(onRequireNewer).toHaveBeenLastCalledWith("updating");
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "skip-waiting" }),
      expect.any(Array),
    );
    expect(reload).not.toHaveBeenCalled();
    container.controller = waiting;
    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledOnce();
    expect(f.revealed).not.toHaveBeenCalled();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(true);
    f.boot.dispose();
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("registers a real kit first-visit offline flow only after successful reveal and paint", async () => {
    const f = fixture();
    f.boot.dispose();
    const registration = Object.assign(new EventTarget(), {
      active: null,
      installing: null,
      update: async () => {},
      waiting: null,
    });
    const register = vi.fn(async () => registration);
    const play = startOfflinePlay(
      {
        onRequireNewer: vi.fn(),
        onUpdateShown: vi.fn(),
        serviceWorkerUrl: "/sw.js",
      },
      {
        container: Object.assign(new EventTarget(), {
          controller: null,
          getRegistration: async () => undefined,
          register,
        }),
        eventTarget: new EventTarget(),
        now: () => 0,
        online: () => true,
        reload: vi.fn(),
        session: undefined,
        visibilitySource: Object.assign(new EventTarget(), {
          visibilityState: "visible" as const,
        }),
      },
    );
    const boot = prepareBootReveal(
      { document: f.document, window: f.window },
      f.root,
      play.registrationReady,
    );
    f.manifestReady();
    boot.ready();
    await settle();
    expect(register).not.toHaveBeenCalled();
    f.images.forEach((image) => image.resolve());
    await settle();
    expect(f.attributes.has(PENDING_ATTRIBUTE)).toBe(false);
    expect(register).not.toHaveBeenCalled();
    f.paint();
    expect(register).not.toHaveBeenCalled();
    f.paint();
    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js", { scope: "/" });
    boot.dispose();
  });
});
