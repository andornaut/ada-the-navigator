import { startOfflinePlay } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { PENDING_ATTRIBUTE } from "@andornaut/game-kit/web/ui/dom/imageReady";
import { describe, expect, it, vi } from "vitest";

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
  } as unknown as Document;
  let nextFrame = 0;
  const window = {
    cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
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
    window,
  };
}

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
    expect(active.at(-1)).toBe(false);
    stop();
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
