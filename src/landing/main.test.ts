import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";

const LANDING = readFileSync(new URL("../../pages/index.html", import.meta.url), "utf8");

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0";
const FIREFOX_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const KINDS = Object.keys(PROTOTYPE.installSteps);

// The landing page is static HTML, so its install copy is checked against the data here.
describe("the landing page's install markup", () => {
  it("gives every browser kind its install steps as the data has them", () => {
    const words = (text: string) => text.replace(/\s+/gu, " ").trim();
    const shown = Object.fromEntries(
      [
        ...LANDING.matchAll(
          /<div data-steps="(\w+)" hidden>\s*<h2 id="install-steps-\1">([^<]*)<\/h2>\s*<p>([^<]*)<\/p>/gu,
        ),
      ].map(([, kind, title, steps]) => [kind, { steps: words(steps!), title: words(title!) }]),
    );
    expect(shown).toEqual(PROTOTYPE.installSteps);
  });

  it("starts with Install hidden, labelled as the data has it", () => {
    expect(LANDING).toMatch(
      new RegExp(`<button[^>]*\\bid="install"[^>]*\\bhidden>${PROTOTYPE.labels.installButton}<`),
    );
  });

  it("gives the steps dialog Close as its only button", () => {
    const dialog = /<dialog[^>]*id="install-steps"[^>]*>([\s\S]*?)<\/dialog>/u.exec(LANDING)?.[1];
    expect(dialog?.match(/<button\b[^>]*>([^<]*)</gu)).toEqual([
      `<button class="site-steps-close" type="button">${PROTOTYPE.labels.close}<`,
    ]);
  });

  it("loads the landing script and none of the game", () => {
    const scripts = [...LANDING.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gu)].map(([, src]) => src);
    expect(scripts).toEqual(["/src/landing/main.ts"]);
  });
});

// Stand-ins for the elements in pages/index.html that the kit's install button reads: one section
// per kind, marked data-steps and titled by its h2, then the close button.
class FakeDialog extends EventTarget {
  readonly close = vi.fn();
  readonly closeButton = new EventTarget();
  readonly labelledBy = vi.fn();
  readonly sections: { dataset: { steps: string }; hidden: boolean }[];
  readonly showModal = vi.fn();
  constructor(kinds: readonly string[] = KINDS) {
    super();
    this.sections = kinds.map((steps) => ({ dataset: { steps }, hidden: true }));
  }
  querySelector(selector: string) {
    if (selector === "button") {
      return this.closeButton;
    }
    const kind = /^\[data-steps="(\w+)"\]( h2)?$/u.exec(selector);
    const section = this.sections.find(({ dataset }) => dataset.steps === kind?.[1]);
    if (!kind || !section) {
      return null;
    }
    return kind[2] ? { id: `install-steps-${kind[1]}` } : section;
  }
  querySelectorAll() {
    return this.sections;
  }
  setAttribute(name: string, value: string) {
    this.labelledBy(name, value);
  }
}

describe("the landing page's Install button", () => {
  let button: EventTarget & { hidden: boolean };
  let dialog: FakeDialog;
  let page: EventTarget;

  async function load(userAgent: string, maxTouchPoints = 0): Promise<void> {
    const navigator = { maxTouchPoints, userAgent };
    page = Object.assign(new EventTarget(), {
      matchMedia: () => ({ addEventListener: () => undefined, matches: false }),
      navigator,
    });
    vi.stubGlobal("window", page);
    vi.stubGlobal("HTMLDialogElement", FakeDialog);
    vi.stubGlobal("document", {
      getElementById: (id: string) => ({ install: button, "install-steps": dialog })[id] ?? null,
    });
    await import("./main.ts");
  }
  // Lets the click's install promise settle.
  const settle = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  const shownKinds = () =>
    dialog.sections.filter((section) => !section.hidden).map(({ dataset }) => dataset.steps);

  beforeEach(() => {
    vi.resetModules();
    button = Object.assign(new EventTarget(), { hidden: true });
    dialog = new FakeDialog();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows for the browser's prompt and asks it to prompt on a click", async () => {
    await load(CHROME);
    const prompt = vi.fn(() => Promise.resolve());
    page.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted" }),
      }),
    );
    expect(button.hidden).toBe(false);
    button.dispatchEvent(new Event("click"));
    await settle();
    expect(prompt).toHaveBeenCalledOnce();
    expect(button.hidden).toBe(true);
    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it.each([
    ["chromiumDesktop", CHROME, 0],
    ["firefoxDesktop", FIREFOX_DESKTOP, 0],
    ["safariMac", SAFARI_MAC, 0],
    ["ios", IPHONE, 5],
    ["firefoxAndroid", FIREFOX_ANDROID, 5],
  ] as const)(
    "shows without a prompt and opens %s's steps alone; Close closes them",
    async (kind, userAgent, touchPoints) => {
      await load(userAgent, touchPoints);
      expect(button.hidden).toBe(false);
      button.dispatchEvent(new Event("click"));
      await settle();
      expect(dialog.showModal).toHaveBeenCalledOnce();
      expect(shownKinds()).toEqual([kind]);
      expect(dialog.labelledBy).toHaveBeenCalledWith("aria-labelledby", `install-steps-${kind}`);
      dialog.closeButton.dispatchEvent(new Event("click"));
      expect(dialog.close).toHaveBeenCalledOnce();
    },
  );

  it("opens the other steps for a kind the dialog has no section for", async () => {
    dialog = new FakeDialog(KINDS.filter((kind) => kind !== "safariMac"));
    await load(SAFARI_MAC);
    button.dispatchEvent(new Event("click"));
    await settle();
    expect(shownKinds()).toEqual(["other"]);
  });
});
