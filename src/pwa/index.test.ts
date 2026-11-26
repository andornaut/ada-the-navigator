import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadingFailureChrome } from "../ui/loadingFailure.ts";

const kit = vi.hoisted(() => {
  const launch = {
    bootProgress: vi.fn(),
    dispose: vi.fn(),
    requestUpdateCheck: vi.fn(),
    requireNewer: vi.fn(),
    run: vi.fn<() => Promise<"play" | "reloading">>(),
  };
  const context = { policy: undefined as unknown };
  const failure = { dispose: vi.fn() };
  return {
    context,
    create: vi.fn(
      (
        value: unknown,
        options: {
          onFailure: (failure: { reason: string; retry: () => void }) => void;
          onNetworkPlay: (notice: { reason: "quota" | "unsupported" }) => void;
          onProgress: (progress: unknown) => void;
          onRequireNewer: (state: "unavailable" | "updating") => void;
          onUpdateReady: (offer: {
            dismiss: () => void;
            updateNow: (save: () => void | PromiseLike<void>) => Promise<void>;
            version: string;
          }) => void;
          onUpdateState: (state: unknown) => void;
          serviceWorkerUrl: string;
          soundFormat: string | undefined;
        },
      ) => {
        void value;
        void options;
        return launch;
      },
    ),
    failure,
    launch,
    supported: true,
  };
});
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/launch", () => ({
  createLaunch: kit.create,
  prepareBrowserLaunch: (
    { onUnsupported }: { readonly onUnsupported: () => void },
    policy: unknown,
  ) => {
    kit.context.policy = policy;
    if (kit.supported) {
      return { context: kit.context, kind: "supported" };
    }
    onUnsupported();
    return { failure: kit.failure, kind: "unsupported" };
  },
}));
const wakeLock = vi.hoisted(() => {
  const lock = { isHeld: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const create = vi.fn((...args: readonly unknown[]) => {
    void args;
    return lock;
  });
  return { create, lock };
});
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/wakeLock", () => ({
  createScreenWakeLock: wakeLock.create,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/storagePersistence", () => ({
  requestPersistentStorage: vi.fn(() => Promise.resolve("unsupported")),
}));

interface Device {
  readonly app?: boolean;
  // Whether the browser has CloseWatcher, as Chrome 120 and later do.
  readonly closeWatcher?: boolean;
  readonly maxTouchPoints?: number;
  // iOS only: opened from the Home Screen.
  readonly standalone?: boolean;
  readonly userAgent?: string;
}

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0";
const FIREFOX_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36";
const SAMSUNG =
  "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36";
const OPERA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36 OPR/120.0";

// The browser's window as the kit's install flow and back guard read it.
function stubDevice({
  app = false,
  closeWatcher = false,
  maxTouchPoints = 0,
  standalone = false,
  userAgent = CHROME,
}: Device): EventTarget {
  const navigator = {
    maxTouchPoints,
    serviceWorker: Object.assign(new EventTarget(), {
      controller: null,
      getRegistration: vi.fn(async () => undefined),
    }),
    standalone,
    userAgent,
  };
  const page = Object.assign(new EventTarget(), {
    close: vi.fn(),
    location: { assign: vi.fn() },
    matchMedia: () => ({ addEventListener: () => undefined, matches: app }),
    navigator,
  });
  // The history stubbed now or later in the test, as window.history reads the global.
  Object.defineProperty(page, "history", { get: () => history });
  vi.stubGlobal("CloseWatcher", closeWatcher ? EventTarget : undefined);
  vi.stubGlobal("window", page);
  vi.stubGlobal("navigator", navigator);
  const frame = { remove: vi.fn(), style: {} };
  const progress = { remove: vi.fn() };
  const document = Object.assign(new EventTarget(), {
    body: { append: vi.fn() },
    createElement: () => frame,
    defaultView: page,
    getElementById: () => mount,
    visibilityState: "visible",
  });
  const mount = {
    clientHeight: 360,
    clientWidth: 720,
    ownerDocument: document,
    querySelector: (selector: string) => (selector === "#boot-progress" ? progress : null),
  };
  vi.stubGlobal("document", document);
  stubHistory();
  return page;
}

// A beforeinstallprompt event whose prompt the player answers with outcome.
function installPrompt(outcome: "accepted" | "dismissed") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
  kit.supported = true;
  kit.launch.run.mockResolvedValue("play");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const options = () => kit.create.mock.calls[0]![1];
const staged = (
  updateNow: (save: () => void | PromiseLike<void>) => Promise<void> = vi.fn(async () => undefined),
) => ({
  dismiss: vi.fn(),
  updateNow,
  version: "next",
});

describe("launch", () => {
  it("creates one launch with the game's policy and router, shared by every call", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    const first = pwa.launchPhoneApp(loadingFailureChrome);
    expect(pwa.launchPhoneApp(loadingFailureChrome)).toBe(first);
    expect(await first).toBe("play");
    expect(kit.create).toHaveBeenCalledOnce();
    expect(kit.launch.run).toHaveBeenCalledOnce();
    expect(kit.context.policy).toEqual({
      cacheNamePrefix: "ada-the-navigator-",
      hashedAssetPrefix: "/assets/",
    });
    expect(Object.keys(options()).sort()).toEqual([
      "onFailure",
      "onNetworkPlay",
      "onProgress",
      "onRequireNewer",
      "onUpdateReady",
      "onUpdateState",
      "serviceWorkerUrl",
      "soundFormat",
    ]);
    expect(options().serviceWorkerUrl).toBe("/sw.js");
    // A game without sound files passes no format.
    expect(options()).toHaveProperty("soundFormat", undefined);
  });

  it("requests a check on the existing launch without creating a new one", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    pwa.requestUpdateCheck();
    expect(kit.create).not.toHaveBeenCalled();
    expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();

    await pwa.launchPhoneApp(loadingFailureChrome);
    expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();
    pwa.requestUpdateCheck();
    expect(kit.launch.requestUpdateCheck).toHaveBeenCalledOnce();
    expect(kit.launch.run).toHaveBeenCalledOnce();
  });

  it("returns reloading from the kit so the game never starts", async () => {
    stubDevice({});
    kit.launch.run.mockResolvedValue("reloading");
    const pwa = await import("./index.ts");
    expect(await pwa.launchPhoneApp(loadingFailureChrome)).toBe("reloading");
  });

  it("plays from the network in development without preparing a production launch", async () => {
    vi.stubEnv("PROD", false);
    stubDevice({});
    const pwa = await import("./index.ts");
    expect(await pwa.launchPhoneApp(loadingFailureChrome)).toBe("play");
    pwa.requestUpdateCheck();
    expect(kit.create).not.toHaveBeenCalled();
    expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();
    const states: string[] = [];
    pwa.requireNewerVersion((state) => states.push(state));
    expect(states).toEqual(["unavailable"]);
  });

  it("exposes unsupported without creating an installer and disposes the prepared notice", async () => {
    kit.supported = false;
    stubDevice({});
    const pwa = await import("./index.ts");
    const parent = document.getElementById("app")!;
    const progress = parent.querySelector("#boot-progress")!;
    const prepared = pwa.preparePhoneLaunch(loadingFailureChrome, parent);
    expect(prepared.kind).toBe("unsupported");
    expect(pwa.preparePhoneLaunch(loadingFailureChrome, parent)).toBe(prepared);
    expect(await pwa.launchPhoneApp(loadingFailureChrome)).toBe("unsupported");
    expect(progress.remove).toHaveBeenCalledOnce();
    expect(document.body.append).toHaveBeenCalledOnce();
    expect(kit.create).not.toHaveBeenCalled();
    expect(kit.launch.run).not.toHaveBeenCalled();
    pwa.requestUpdateCheck();
    expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();
    const states: string[] = [];
    pwa.requireNewerVersion((state) => states.push(state));
    expect(states).toEqual(["unavailable"]);
    if (prepared.kind === "unsupported") {
      prepared.dispose();
    }
    expect(kit.failure.dispose).toHaveBeenCalledOnce();
    const [frame] = vi.mocked(document.body.append).mock.calls[0]!;
    expect((frame as HTMLElement).remove).toHaveBeenCalledOnce();
  });

  it("counts the boot preload's settled share into the launch's progress", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    const { waitedProgress } = await import("../loading/progress.ts");
    await pwa.launchPhoneApp(loadingFailureChrome);
    const handle = waitedProgress.begin();
    handle.progress(0.25);
    handle.progress(1);
    expect(kit.launch.bootProgress.mock.calls).toEqual([
      [0.25, 1],
      [1, 1],
    ]);
  });

  it("shows a failed first install's Loading failed and resumes it on Retry", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    const { observeInstallation } = await import("./installationPresentation.ts");
    void pwa.launchPhoneApp(loadingFailureChrome);
    const views: { kind: string }[] = [];
    let latest: { retry: () => Promise<void> } | undefined;
    observeInstallation((view) => {
      views.push(view.state);
      latest = view;
    });
    const retry = vi.fn();
    options().onFailure({ reason: "network", retry });
    expect(views.at(-1)).toMatchObject({ error: "network", kind: "failed" });
    await latest!.retry();
    expect(retry).toHaveBeenCalledOnce();
    expect(views.at(-1)!.kind).toBe("loading");
  });

  it.each(["unsupported", "quota"] as const)(
    "relays a %s first install's network play to the game, before or after it listens",
    async (reason) => {
      stubDevice({});
      const pwa = await import("./index.ts");
      void pwa.launchPhoneApp(loadingFailureChrome);
      options().onNetworkPlay({ reason });
      const early = vi.fn();
      pwa.networkPlayNotice(early);
      expect(early).toHaveBeenCalledExactlyOnceWith({ reason });
      const late = vi.fn();
      pwa.networkPlayNotice(late);
      options().onNetworkPlay({ reason });
      expect(late.mock.calls).toEqual([[{ reason }], [{ reason }]]);
    },
  );

  it("offers a staged version on any screen; Update now saves, then switches", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    const { installProgress } = await import("../loading/progress.ts");
    void pwa.launchPhoneApp(loadingFailureChrome);
    const visible: boolean[] = [];
    pwa.updateOffer.subscribe((shown) => visible.push(shown));
    const save = vi.fn();
    pwa.saveBeforeUpdate(save);
    let active = false;
    const stop = installProgress.subscribe((state) => {
      active = state.active;
    });
    const update = staged(
      vi.fn(async (before: () => void | PromiseLike<void>) => {
        await before();
      }),
    );
    options().onUpdateReady(update);
    expect(visible).toEqual([false, true]);
    pwa.updateOffer.accept();
    pwa.updateOffer.accept();
    expect(visible).toEqual([false, true]);
    expect(active).toBe(true);
    await vi.waitFor(() => expect(visible).toEqual([false, true, false]));
    expect(update.updateNow).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    expect(update.dismiss).not.toHaveBeenCalled();
    stop();
  });

  it("continues play when Update now finds the staged build gone", async () => {
    stubDevice({});
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pwa = await import("./index.ts");
    const { installProgress } = await import("../loading/progress.ts");
    void pwa.launchPhoneApp(loadingFailureChrome);
    let active = true;
    const stop = installProgress.subscribe((state) => {
      active = state.active;
    });
    options().onUpdateReady(staged(vi.fn(async () => Promise.reject(new Error("gone")))));
    pwa.updateOffer.accept();
    await vi.waitFor(() => expect(active).toBe(false));
    stop();
  });

  it("dismisses once, keeping the active build until the next launch", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    void pwa.launchPhoneApp(loadingFailureChrome);
    const update = staged();
    options().onUpdateReady(update);
    pwa.updateOffer.defer();
    pwa.updateOffer.defer();
    pwa.updateOffer.accept();
    expect(update.dismiss).toHaveBeenCalledOnce();
    expect(update.updateNow).not.toHaveBeenCalled();
  });

  it("requires the newer version for a newer save and reports its state as it changes", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    void pwa.launchPhoneApp(loadingFailureChrome);
    const states: string[] = [];
    pwa.requireNewerVersion((state) => states.push(state));
    expect(kit.launch.requireNewer).toHaveBeenCalledOnce();
    expect(states).toEqual([]);
    options().onRequireNewer("unavailable");
    options().onRequireNewer("updating");
    expect(states).toEqual(["unavailable", "updating"]);
  });

  it.each([false, true])("asks for persistent storage as the installed app: %s", async (app) => {
    const { requestPersistentStorage } =
      await import("@andornaut/game-kit/runtime/web/pwa/storagePersistence");
    stubDevice({ app });
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(vi.mocked(requestPersistentStorage)).toHaveBeenCalledExactlyOnceWith(app, undefined);
  });
});

// The page's history as the back guard reads it, with no entry before the game.
function stubHistory() {
  const history = {
    back: vi.fn(),
    length: 1,
    pushState: vi.fn((state: unknown) => {
      history.state = state;
      history.length += 1;
    }),
    state: null as unknown,
  };
  vi.stubGlobal("history", history);
  return history;
}

describe("screen wake lock", () => {
  it("keeps the screen on only while the game asks, with the page's own wake lock", async () => {
    const page = stubDevice({});
    const lockApi = { request: vi.fn() };
    Object.assign(navigator, { wakeLock: lockApi });
    const pwa = await import("./index.ts");
    pwa.keepScreenOn(true);
    expect(wakeLock.lock.start).not.toHaveBeenCalled();
    pwa.setupPhoneApp();
    expect(wakeLock.create).toHaveBeenCalledWith(page, document, lockApi);
    expect(wakeLock.lock.start).not.toHaveBeenCalled();
    pwa.keepScreenOn(true);
    expect(wakeLock.lock.start).toHaveBeenCalledOnce();
    pwa.keepScreenOn(false);
    expect(wakeLock.lock.stop).toHaveBeenCalledOnce();
  });

  it("passes no wake lock where the browser has none", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(wakeLock.create.mock.calls[0]![2]).toBeUndefined();
  });
});

const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Safari/605.1.15";
const EDGE_ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/142.0 Mobile Safari/537.36 EdgA/142.0";
const EDGE_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0 Safari/537.36 Edg/142.0";

describe("exit", () => {
  // Each platform the kit's appPlatform names, as a browser tab and as an installed app: Exit
  // shows only in the installed app windows a script can close, never in a browser tab.
  const devices: readonly [string, Device, boolean][] = [
    ["a desktop Chrome tab", {}, false],
    ["an Android Chrome tab", { closeWatcher: true, userAgent: CHROME_ANDROID }, false],
    ["an iPhone Safari tab", { maxTouchPoints: 5, userAgent: IPHONE }, false],
    ["Chrome's Android app", { app: true, closeWatcher: true, userAgent: CHROME_ANDROID }, true],
    ["a Chrome desktop app window", { app: true, closeWatcher: true }, true],
    [
      "an Edge desktop app window",
      { app: true, closeWatcher: true, userAgent: EDGE_DESKTOP },
      true,
    ],
    [
      "an iPhone Home Screen app",
      { app: true, maxTouchPoints: 5, standalone: true, userAgent: IPHONE },
      false,
    ],
    ["an iPad Home Screen app", { app: true, maxTouchPoints: 5, userAgent: IPAD }, false],
    ["Firefox for Android's app", { app: true, userAgent: FIREFOX_ANDROID }, false],
    ["Samsung Internet's app", { app: true, closeWatcher: true, userAgent: SAMSUNG }, false],
    ["Edge for Android's app", { app: true, closeWatcher: true, userAgent: EDGE_ANDROID }, false],
    ["a macOS Safari Dock app", { app: true, userAgent: SAFARI_MAC }, false],
    ["a Chrome app window without CloseWatcher", { app: true }, false],
  ];

  it.each(devices)("shows Exit in %s: %s", async (_name, device, shown) => {
    stubDevice(device);
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.exitShown()).toBe(shown);
  });

  it("reads Exit once at load, before the back guard adds an entry", async () => {
    const page = stubDevice({ app: true, closeWatcher: true, userAgent: CHROME_ANDROID });
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(new Event("pointerup"));
    history.length = 3;
    expect(pwa.exitShown()).toBe(true);
  });

  it("closes an installed app's window and never navigates", async () => {
    const app = stubDevice({ app: true, closeWatcher: true }) as unknown as {
      close: () => void;
      location: { assign: (url: string) => void };
    };
    let pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    pwa.exitGame();
    expect(app.close).toHaveBeenCalledOnce();
    expect(app.location.assign).not.toHaveBeenCalled();
    vi.resetModules();
    const tab = stubDevice({}) as unknown as typeof app;
    pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    pwa.exitGame();
    expect(tab.close).not.toHaveBeenCalled();
    expect(tab.location.assign).not.toHaveBeenCalled();
  });
});

describe("back gesture", () => {
  it("guards back in a browser tab, which shows no Exit", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
    page.dispatchEvent(new Event("pointerup"));
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(pwa.exitShown()).toBe(false);
    expect(backs).toHaveBeenCalledOnce();
  });

  it("leaves back to the browser until the player's first input", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
    expect(history.pushState).not.toHaveBeenCalled();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
    // Back pops the guard entry: the game hears back and the guard returns.
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).toHaveBeenCalledOnce();
    expect(history.pushState).toHaveBeenCalledTimes(2);
  });

  it("ignores forward onto the guard entry", async () => {
    const page = stubDevice({});
    stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
    page.dispatchEvent(new Event("pointerup"));
    page.dispatchEvent(new Event("popstate"));
    expect(backs).not.toHaveBeenCalled();
  });

  it("leaves back to the browser on the start screen with nothing open", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
    page.dispatchEvent(new Event("pointerup"));
    pwa.setBackArmed(false);
    // Back pops the guard entry; the game hears nothing, no guard returns and the browser steps
    // back past the game.
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).not.toHaveBeenCalled();
    expect(history.pushState).toHaveBeenCalledOnce();
    expect(history.back).toHaveBeenCalledOnce();
    // Input on the released start screen adds no guard.
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
    pwa.setBackArmed(true);
  });

  it("re-arms during the player's input as flight starts or a card opens", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
    pwa.setBackArmed(false);
    Object.assign(navigator, { userActivation: { isActive: true } });
    pwa.setBackArmed(true);
    expect(history.pushState).toHaveBeenCalledOnce();
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).toHaveBeenCalledOnce();
    expect(history.back).not.toHaveBeenCalled();
  });

  it("re-arms without an entry outside the player's input, until the next input", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    pwa.setBackArmed(false);
    pwa.setBackArmed(true);
    expect(history.pushState).not.toHaveBeenCalled();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
  });

  it.each([
    ["Samsung Internet", { app: true, closeWatcher: true, userAgent: SAMSUNG }],
    [
      "an iPhone Home Screen",
      { app: true, maxTouchPoints: 5, standalone: true, userAgent: IPHONE },
    ],
  ] satisfies [string, Device][])(
    "keeps %s app's own back, since its window cannot close",
    async (_name, device) => {
      const page = stubDevice(device);
      const history = stubHistory();
      const pwa = await import("./index.ts");
      pwa.setupPhoneApp();
      const backs = vi.fn();
      page.addEventListener(pwa.PHONE_BACK_PRESSED, backs);
      page.dispatchEvent(new Event("pointerup"));
      page.dispatchEvent(new Event("popstate"));
      expect(history.pushState).not.toHaveBeenCalled();
      expect(backs).not.toHaveBeenCalled();
    },
  );

  it("keeps the browser's back in Firefox for Android's installed app", async () => {
    const page = stubDevice({ app: true, userAgent: FIREFOX_ANDROID });
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).not.toHaveBeenCalled();
  });
});

describe("install offer", () => {
  it("offers the browser's prompt once it arrives, and is installed after acceptance", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const states: string[] = [];
    pwa.onInstallStateChange((state) => states.push(state));
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);

    const prompt = installPrompt("accepted");
    page.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect(pwa.installState()).toBe("prompt");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);

    await expect(pwa.installApp()).resolves.toBe("accepted");
    expect(prompt.prompt).toHaveBeenCalledOnce();
    expect(pwa.installState()).toBe("installed");
    expect(states).toEqual(["prompt", "installed"]);
  });

  it("falls back to the browser's steps after a dismissed prompt", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(installPrompt("dismissed"));
    await expect(pwa.installApp()).resolves.toBe("dismissed");
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);
    await expect(pwa.installApp()).resolves.toBe("steps");
    expect(pwa.stepsKind()).toBe("chromiumDesktop");
  });

  it("stops calling a listener once it unsubscribes", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    const listener = vi.fn();
    pwa.onInstallStateChange(listener)();
    page.dispatchEvent(installPrompt("accepted"));
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    { device: { userAgent: CHROME }, kind: "chromiumDesktop" },
    { device: { maxTouchPoints: 5, userAgent: CHROME_ANDROID }, kind: "chromiumAndroid" },
    { device: { userAgent: FIREFOX_DESKTOP }, kind: "firefoxDesktop" },
    { device: { maxTouchPoints: 5, userAgent: FIREFOX_ANDROID }, kind: "firefoxAndroid" },
    { device: { maxTouchPoints: 5, userAgent: IPHONE }, kind: "ios" },
    { device: { userAgent: SAFARI_MAC }, kind: "safariMac" },
    { device: { maxTouchPoints: 5, userAgent: SAMSUNG }, kind: "samsungInternet" },
    { device: { userAgent: OPERA }, kind: "other" },
  ] as const)("asks for $kind's steps where no prompt exists", async ({ device, kind }) => {
    stubDevice(device);
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);
    expect(pwa.stepsKind()).toBe(kind);
    await expect(pwa.installApp()).resolves.toBe("steps");
  });

  it("offers nothing while running as the installed app", async () => {
    stubDevice({ app: true, maxTouchPoints: 5, userAgent: IPHONE });
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.installState()).toBe("installed");
    expect(pwa.offersInstall(pwa.installState())).toBe(false);
  });
});
