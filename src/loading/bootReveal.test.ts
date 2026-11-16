import { createRequiredLoading } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { startOfflinePlay } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./requiredFonts.ts", () => ({ requireBootFonts: () => () => {} }));
import { prepareBootReveal } from "./bootReveal.ts";
import { requireBootUi } from "./requiredUi.ts";
async function settle() {
  for (let n = 0; n < 30; n++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}
function fixture() {
  const images: { src: string; resolve: () => void; reject: () => void }[] = [],
    frames = new Map<number, FrameRequestCallback>();
  let frame = 0;
  const createImage = () => {
    let current = "",
      decode!: Promise<void>;
    const image = {
      closest: () => null,
      currentSrc: "",
      decode: () => decode,
      naturalHeight: 0,
      naturalWidth: 0,
      removeAttribute: () => {
        current = "";
      },
      get src() {
        return current;
      },
      set src(value: string) {
        current = value;
        decode = new Promise<void>((resolve, reject) => {
          images.push({
            reject: () => {
              image.naturalWidth = 0;
              reject(new Error("decode failed"));
            },
            resolve: () => {
              image.naturalWidth = 10;
              image.naturalHeight = 10;
              resolve();
            },
            src: value,
          });
        });
      },
      tagName: "IMG",
    };
    return image;
  };
  const visible = createImage();
  visible.src = "https://game.test/ship.svg";
  const ui = {
    closest: () => null,
    inert: false,
    querySelectorAll: () => [visible, { closest: () => ({}), tagName: "SPAN" }],
    removeAttribute: vi.fn(),
    setAttribute: vi.fn(),
    tagName: "DIV",
  } as unknown as HTMLElement;
  const canvas = { ...ui, querySelectorAll: () => [] } as unknown as HTMLElement;
  const splash = { remove: vi.fn() };
  const document = {
    baseURI: "https://game.test/play/",
    createElement: createImage,
    getElementById: () => splash,
  } as unknown as Document;
  const fetch = vi.fn(async () => ({
    json: async () => ({
      fonts: [{ png: "fonts/body.png" }],
      sprites: [{ png: "sprites/button.png" }],
    }),
    ok: true,
  }));
  const window = {
    cancelAnimationFrame: (id: number) => frames.delete(id),
    clearTimeout: globalThis.clearTimeout,
    fetch,
    getComputedStyle: () => ({
      backgroundImage: "none",
      borderImageSource: "none",
      display: "block",
      visibility: "visible",
    }),
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++frame, fn);
      return frame;
    },
    setTimeout: globalThis.setTimeout,
  } as unknown as Window;
  const required = createRequiredLoading();
  return {
    document,
    images,
    paint: () => {
      const ready = [...frames];
      frames.clear();
      ready.forEach(([, fn]) => fn(0));
    },
    required,
    root: canvas,
    splash,
    ui,
    window,
  };
}
afterEach(() => vi.restoreAllMocks());
it("requires active screen decodes and two paint turns before registration", async () => {
  const f = fixture(),
    shown = vi.fn();
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    shown,
  );
  boot.collect();
  const commit = vi.fn(() => boot.commit());
  f.required.wait(commit);
  await settle();
  expect(f.ui.inert).toBe(true);
  expect(shown).not.toHaveBeenCalled();
  expect(f.images).toHaveLength(3);
  f.images.forEach((i) => i.resolve());
  await settle();
  expect(commit).toHaveBeenCalledOnce();
  expect(f.ui.inert).toBe(false);
  expect(f.splash.remove).toHaveBeenCalledOnce();
  expect(shown).not.toHaveBeenCalled();
  f.paint();
  expect(shown).not.toHaveBeenCalled();
  f.paint();
  expect(shown).toHaveBeenCalledOnce();
  f.required.dispose();
  boot.dispose();
});
it("retries a failed active image while leaving hidden optional art alone", async () => {
  const f = fixture(),
    shown = vi.fn();
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    shown,
  );
  boot.collect();
  f.required.wait(() => boot.commit());
  await settle();
  const ship = f.images.find((i) => i.src.endsWith("/ship.svg"))!;
  f.images.forEach((i) => (i === ship ? i.reject() : i.resolve()));
  await settle();
  expect(f.required.state.kind).toBe("failed");
  expect(f.ui.inert).toBe(true);
  expect(shown).not.toHaveBeenCalled();
  const retry = f.required.retry();
  await settle();
  expect(f.images).toHaveLength(4);
  f.images.at(-1)!.resolve();
  await retry;
  await settle();
  f.paint();
  f.paint();
  expect(shown).toHaveBeenCalledOnce();
  f.required.dispose();
  boot.dispose();
});
it("never reveals or registers after disposal with decodes and prepared paint callbacks outstanding", async () => {
  const f = fixture(),
    shown = vi.fn();
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    shown,
  );
  boot.collect();
  f.required.wait(() => boot.commit());
  await settle();
  f.required.dispose();
  boot.dispose();
  f.images.forEach((i) => i.resolve());
  await settle();
  f.paint();
  f.paint();
  expect(shown).not.toHaveBeenCalled();
});

it.each([0, 1])(
  "cancels registration after reveal with %s prepared paint turns",
  async (paints) => {
    const f = fixture(),
      shown = vi.fn();
    const boot = prepareBootReveal(
      { document: f.document, required: f.required, ui: f.ui, window: f.window },
      f.root,
      shown,
    );
    boot.collect();
    f.required.wait(() => boot.commit());
    await settle();
    f.images.forEach((i) => i.resolve());
    await settle();
    for (let n = 0; n < paints; n++) {
      f.paint();
    }
    boot.dispose();
    f.paint();
    f.paint();
    expect(shown).not.toHaveBeenCalled();
    f.required.dispose();
  },
);

function offline(controlled: boolean) {
  const postMessage = vi.fn();
  const waiting = Object.assign(new EventTarget(), { postMessage, state: "installed" });
  const registration = Object.assign(new EventTarget(), {
    active: controlled
      ? Object.assign(new EventTarget(), { postMessage: vi.fn(), state: "activated" })
      : null,
    installing: null,
    update: async () => {},
    waiting: controlled ? waiting : null,
  });
  const register = vi.fn(async () => registration),
    reload = vi.fn(),
    onRequireNewer = vi.fn();
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? ({} as unknown) : null,
    getRegistration: async () => undefined,
    register,
  });
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
  return { container, onRequireNewer, play, postMessage, register, reload, waiting };
}
it("keeps the real first-visit PWA registration after required reveal and both prepared paint turns", async () => {
  const f = fixture(),
    pwa = offline(false);
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    pwa.play.registrationReady,
  );
  boot.collect();
  f.required.wait(() => boot.commit());
  await settle();
  expect(pwa.register).not.toHaveBeenCalled();
  f.images.forEach((i) => i.resolve());
  await settle();
  expect(pwa.register).not.toHaveBeenCalled();
  f.paint();
  expect(pwa.register).not.toHaveBeenCalled();
  f.paint();
  expect(pwa.register).toHaveBeenCalledExactlyOnceWith("/sw.js", { scope: "/" });
  boot.dispose();
  f.required.dispose();
});
it("keeps a controlled newer-save update independent of blocked required boot art", async () => {
  const f = fixture(),
    pwa = offline(true),
    shown = vi.fn();
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    shown,
  );
  boot.collect();
  await pwa.play.launchReady();
  await settle();
  expect(f.ui.inert).toBe(true);
  pwa.play.flow.requireNewer();
  expect(pwa.onRequireNewer).toHaveBeenLastCalledWith("updating");
  expect(pwa.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: "skip-waiting" }),
    expect.any(Array),
  );
  pwa.container.controller = pwa.waiting;
  pwa.container.dispatchEvent(new Event("controllerchange"));
  pwa.container.dispatchEvent(new Event("controllerchange"));
  expect(pwa.reload).toHaveBeenCalledOnce();
  expect(shown).not.toHaveBeenCalled();
  boot.dispose();
  f.required.dispose();
});

it("requires sibling CSS backgrounds and border images while preserving successful decodes on Retry", async () => {
  const f = fixture(),
    shown = vi.fn();
  const css = { closest: () => null, tagName: "DIV" } as unknown as HTMLElement;
  const nodes = [...f.ui.querySelectorAll("*")];
  vi.spyOn(f.ui, "querySelectorAll").mockReturnValue([
    ...nodes,
    css,
  ] as unknown as NodeListOf<HTMLElement>);
  const style = f.window.getComputedStyle.bind(f.window);
  vi.spyOn(f.window, "getComputedStyle").mockImplementation((node) =>
    node === css
      ? ({
          ...style(node),
          backgroundImage: 'url("/required-field.svg")',
          borderImageSource: 'url("/required-border.png")',
        } as CSSStyleDeclaration)
      : style(node),
  );
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, window: f.window },
    f.root,
    shown,
  );
  boot.collect();
  f.required.wait(() => boot.commit());
  await settle();
  expect(f.root.querySelectorAll("*")).toHaveLength(0);
  expect(f.ui.inert).toBe(true);
  const border = f.images.find((image) => image.src.endsWith("/required-border.png"))!;
  expect(f.images.some((image) => image.src.endsWith("/required-field.svg"))).toBe(true);
  f.images.forEach((image) => (image === border ? image.reject() : image.resolve()));
  await settle();
  expect(f.required.state.kind).toBe("failed");
  expect(shown).not.toHaveBeenCalled();
  const retry = f.required.retry();
  await settle();
  expect(f.images.at(-1)!.src).toBe(border.src);
  f.images.at(-1)!.resolve();
  await retry;
  await settle();
  f.paint();
  f.paint();
  expect(f.ui.inert).toBe(false);
  expect(shown).toHaveBeenCalledOnce();
  expect(f.images.filter((image) => image.src.endsWith("/required-field.svg"))).toHaveLength(1);
  boot.dispose();
  f.required.dispose();
});

it("retains an earlier required UI provider through reveal without fetching its manifest again", async () => {
  const f = fixture();
  const uiAssets = requireBootUi(f.required, { document: f.document, window: f.window });
  await settle();
  const boot = prepareBootReveal(
    { document: f.document, required: f.required, ui: f.ui, uiAssets, window: f.window },
    f.root,
    vi.fn(),
  );
  boot.collect();
  f.required.wait(() => boot.commit());
  expect(f.window.fetch).toHaveBeenCalledOnce();
  expect(boot.uiManifest).toBe(uiAssets.manifest);
  f.images.forEach((image) => image.resolve());
  await settle();
  expect(f.required.state.kind).toBe("ready");
  expect(f.ui.inert).toBe(false);
  boot.dispose();
  boot.dispose();
  uiAssets.dispose();
  f.required.dispose();
});
