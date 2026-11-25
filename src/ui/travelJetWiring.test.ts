import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import data from "../../public/art/quantum-jump.json";
import mainData from "../../public/art/ship-jets.json";
import { CONTENT } from "../data/content.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import { LIGHT_FIELD } from "../game/lightField.ts";
import { type QuantumJump, readQuantumJump } from "../game/quantumJump.ts";
import { type JetGeometry, readEngineJets } from "../game/shipJets.ts";
import { staticShipJets } from "../game/staticShipJets.ts";
import * as actionBinding from "./actionBinding.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { createGalaxyMap, type GalaxyMapView } from "./galaxyMap.ts";
import { createJumpOverlay, type SheetArt } from "./jumpOverlay.ts";
import { drawShipJets, drawShipTail } from "./shipJetCanvas.ts";

const events = vi.hoisted(() => [] as string[]);
vi.mock("./shipJetCanvas.ts", () => ({
  drawShipJets: vi.fn(() => events.push("jets")),
  drawShipTail: vi.fn(() => events.push("tail")),
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({ focusTarget: vi.fn() }));

const main = readEngineJets(mainData)!;
// The galaxy map's Earth and destination strings as the scene reads them from content.
const destinationLabels = {
  earthDescription: CONTENT.labels.galaxyEarthDescription!,
  earthKicker: CONTENT.labels.galaxyEarthKicker!,
  earthTitle: CONTENT.labels.galaxyEarthTitle!,
  jumpEarth: CONTENT.labels.galaxyJumpEarth!,
  jumpTo: CONTENT.labels.galaxyJumpTo!,
  stayEarth: CONTENT.labels.galaxyStayEarth!,
  stayIn: CONTENT.labels.galaxyStayIn!,
};
const display = { height: 64, width: 64 };
const sheet: SheetArt = {
  ...display,
  frameHeight: 64,
  frameWidth: 64,
  frames: {},
  url: "sheet.svg",
};

function dom(hasActionRoot = true) {
  let request = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const nodes: ElementFake[] = [];
  const context = {
    arc() {},
    beginPath() {},
    clearRect() {},
    clip() {},
    closePath() {},
    drawImage() {
      events.push("image");
    },
    fillRect() {},
    globalAlpha: 1,
    lineTo() {},
    moveTo() {},
    rect() {},
    restore() {},
    save() {},
    setTransform() {},
    stroke() {},
  };
  class ElementFake {
    get isConnected(): boolean {
      return this.tag === "host" || (this.parentNode?.isConnected ?? false);
    }
    get parentElement() {
      return this.parentNode;
    }
    closest(): ElementFake | null {
      return this.hidden || this.attributes.has("inert")
        ? this
        : (this.parentNode?.closest() ?? null);
    }
    children: ElementFake[] = [];
    readonly nodeType = 1;
    parentNode: ElementFake | null = null;
    get ownerDocument() {
      return document;
    }
    get firstChild() {
      return this.children[0] ?? null;
    }
    get nextSibling() {
      return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null;
    }
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    insertBefore(node: ElementFake, before: ElementFake | null): void {
      if (node === before) {
        return;
      }
      node.remove();
      node.parentNode = this;
      this.children.splice(
        before === null ? this.children.length : this.children.indexOf(before),
        0,
        node,
      );
    }
    className = "";
    classList = {
      add: (...names: string[]) => {
        this.className = [
          ...new Set([...this.className.split(" ").filter(Boolean), ...names]),
        ].join(" ");
      },
      remove: (...names: string[]) => {
        this.className = this.className
          .split(" ")
          .filter((name) => !names.includes(name))
          .join(" ");
      },
      toggle: (name: string, force: boolean) => {
        if (force) {
          this.classList.add(name);
        } else {
          this.classList.remove(name);
        }
        return force;
      },
    };
    clientHeight = 540;
    clientWidth = 960;
    dataset: Record<string, string> = {};
    height = 0;
    disabled = false;
    hidden = false;
    style = { backgroundImage: "", removeProperty() {}, setProperty() {}, zIndex: "" };
    width = 0;
    private text = "";
    get textContent(): string {
      return this.text + this.children.map((child) => child.textContent).join("");
    }
    set textContent(value: string) {
      this.replaceChildren();
      this.text = value;
    }
    readonly attributes = new Map<string, string>();
    readonly tag: string;
    constructor(tag: string) {
      this.tag = tag;
      nodes.push(this);
    }
    readonly listeners = new Map<string, ((event?: Event) => void)[]>();
    addEventListener(type: string, callback: (event?: Event) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
    }
    removeEventListener(type: string, callback: (event?: Event) => void) {
      this.listeners.set(
        type,
        (this.listeners.get(type) ?? []).filter((value) => value !== callback),
      );
    }
    click() {
      const event = Object.assign(new Event("click", { cancelable: true }), { detail: 0 });
      for (const callback of this.listeners.get("click") ?? []) {
        callback(event);
      }
    }
    append(...elements: ElementFake[]) {
      for (const element of elements) {
        this.insertBefore(element, null);
      }
    }
    cloneNode(deep = false): ElementFake {
      const clone = new ElementFake(this.tag);
      clone.className = this.className;
      clone.dataset = { ...this.dataset };
      clone.height = this.height;
      clone.hidden = this.hidden;
      clone.text = this.text;
      clone.width = this.width;
      Object.assign(clone.style, this.style);
      for (const [name, value] of this.attributes) {
        clone.attributes.set(name, value);
      }
      if (deep) {
        clone.append(...this.children.map((child) => child.cloneNode(true)));
      }
      return clone;
    }
    querySelector(selector: string): ElementFake | null {
      for (const child of this.children) {
        if (selector.startsWith(".") && child.className.split(/\s+/u).includes(selector.slice(1))) {
          return child;
        }
        const match = child.querySelector(selector);
        if (match) {
          return match;
        }
      }
      return null;
    }
    matches(selector: string): boolean {
      return selector.split(",").some((part) => {
        const rule = part.trim();
        return rule === this.tag || (rule === "[data-action]" && "action" in this.dataset);
      });
    }
    querySelectorAll(selector: string): ElementFake[] {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    getContext() {
      return context;
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      }
    }
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    replaceChildren(...elements: ElementFake[]) {
      for (const child of [...this.children]) {
        child.remove();
      }
      this.append(...elements);
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    toggleAttribute(name: string, shown: boolean) {
      if (shown) {
        this.setAttribute(name, "");
      } else {
        this.removeAttribute(name);
      }
    }
  }
  const document = {
    createElement: (tag: string) => new ElementFake(tag),
    createElementNS: (_namespace: string, tag: string) => new ElementFake(tag),
    defaultView: { HTMLElement: ElementFake, Node: ElementFake },
    hidden: false,
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  vi.stubGlobal(
    "Image",
    class {
      complete = true;
      decoding = "";
      naturalWidth = 256;
      src = "";
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++request, callback);
    return request;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.spyOn(performance, "now").mockReturnValue(0);
  const host = new ElementFake("host");
  if (hasActionRoot) {
    fixtureActionRoot(host);
  }
  return {
    callbacks,
    host: host as unknown as HTMLElement,
    nodes,
    tick(now: number) {
      const current = [...callbacks.values()];
      callbacks.clear();
      for (const callback of current) {
        callback(now);
      }
    },
  };
}

beforeEach(() => {
  events.length = 0;
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function effect(pose = "bank-16"): QuantumJump {
  const jump = readQuantumJump(data)!;
  return {
    ...jump,
    frames: [
      { ms: 1000, name: "charge", startMs: 0, steps: [{ ms: 1000, ship: { pose, scale: 1 } }] },
    ],
  };
}

function legacyGeometry(geometry: JetGeometry): JetGeometry {
  return {
    ...geometry,
    headings: geometry.headings.map((mouths) =>
      mouths.map((mouth) => {
        const legacy = { ...mouth };
        Reflect.deleteProperty(legacy, "normalAperture");
        return legacy;
      }),
    ),
  };
}

function apertureGeometry(geometry: JetGeometry): JetGeometry {
  return {
    ...geometry,
    headings: geometry.headings.map((mouths) =>
      mouths.map(({ anchor, axis, half }) => ({
        anchor,
        axis,
        half,
        normalAperture: { coreWidth: 6.875 / 18.72 },
        occluders: [],
      })),
    ),
  };
}

function play(reducedMotion = false) {
  const scene = { center: { x: 480, y: 270 }, heading: 0, specks: [] };
  return {
    destination: () => scene,
    emergency: false,
    onCover: vi.fn(),
    onDone: vi.fn(),
    onSwitch: vi.fn(),
    reducedMotion,
    source: scene,
  };
}

describe("warp material wiring", () => {
  it("draws full-pose jets before the hull and reads engine/field changes without paint reload", () => {
    const fixture = dom();
    const jump = effect();
    const legacy = {
      ...jump,
      warp: {
        ...jump.warp,
        poses: jump.warp.poses.map((pose) => ({
          ...pose,
          ...(pose.jets ? { jets: legacyGeometry(pose.jets) } : {}),
        })),
      },
    };
    const overlay = createJumpOverlay(() => performance.now(), fixture.host, {
      field: sheet,
      glow: sheet,
      jump: legacy,
      star: sheet,
      tunnel: sheet,
    });
    let level = 1;
    const sprites = Array.from({ length: 64 }, () => "idle.svg");
    overlay.setPaint({
      jets: () => staticShipJets(main, undefined, level),
      scheme: "classic",
      sprites,
    });
    const running = play();
    overlay.play(running);
    fixture.tick(10);
    expect(vi.mocked(drawShipJets).mock.calls[0]![1].layers).toBe(main.engineLevels[0]);
    expect(vi.mocked(drawShipJets).mock.calls[0]![1].frame).toBe(256);
    expect(events.indexOf("jets")).toBeLessThan(events.indexOf("image"));
    level = 3;
    fixture.tick(20);
    expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(main.engineLevels[2]);
    overlay.setPaint({
      jets: () => staticShipJets(main, LIGHT_FIELD.jets.shipLevels, 2),
      scheme: "classic",
      sprites,
    });
    fixture.tick(30);
    expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(main.engineLevels[1]);
    const legacyMain = { ...main, ...legacyGeometry(main) };
    overlay.setPaint({
      jets: () => staticShipJets(legacyMain, LIGHT_FIELD.jets.shipLevels, 2),
      scheme: "classic",
      sprites,
    });
    fixture.tick(40);
    expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(LIGHT_FIELD.jets.shipLevels[1]);
    overlay.setPaint({
      jets: () => staticShipJets(legacyMain, undefined, 2),
      scheme: "classic",
      sprites,
    });
    fixture.tick(50);
    expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(main.engineLevels[1]);
    expect(running.onCover).toHaveBeenCalledTimes(1);
    overlay.dispose();
    expect(fixture.callbacks.size).toBe(0);
  });

  it("draws complete normal aperture warp triangles after the hull", () => {
    const fixture = dom();
    const jump = effect();
    const overlay = createJumpOverlay(() => performance.now(), fixture.host, {
      field: sheet,
      glow: sheet,
      jump: {
        ...jump,
        warp: {
          ...jump.warp,
          poses: jump.warp.poses.map((pose) => ({
            ...pose,
            ...(pose.jets ? { jets: apertureGeometry(pose.jets) } : {}),
          })),
        },
      },
      star: sheet,
      tunnel: sheet,
    });
    overlay.setPaint({
      jets: () => staticShipJets(main, undefined, 1),
      scheme: "classic",
      sprites: Array.from({ length: 64 }, () => "idle.svg"),
    });
    overlay.play(play());
    fixture.tick(10);
    expect(drawShipJets).toHaveBeenCalled();
    expect(events.lastIndexOf("jets")).toBeGreaterThan(events.lastIndexOf("image"));
    expect(drawShipTail).toHaveBeenCalled();
    expect(events.lastIndexOf("tail")).toBeGreaterThan(events.lastIndexOf("jets"));
    overlay.dispose();
  });

  it.each([false, true])(
    "keeps coast and reduced-motion draws jet-free (reduced %s)",
    (reduced) => {
      const fixture = dom();
      const overlay = createJumpOverlay(() => performance.now(), fixture.host, {
        field: sheet,
        glow: sheet,
        jump: effect("bank-8"),
        star: sheet,
        tunnel: sheet,
      });
      overlay.setPaint({
        jets: () => staticShipJets(main, undefined, 3),
        scheme: "classic",
        sprites: Array.from({ length: 64 }, () => "idle.svg"),
      });
      overlay.play(play(reduced));
      fixture.tick(10);
      expect(drawShipJets).not.toHaveBeenCalled();
      overlay.dispose();
    },
  );
});

function mapView(flight: GalaxyMapView["flight"]): GalaxyMapView {
  return {
    flight,
    galaxies: Array.from({ length: 6 }, () => ({
      flavor: "",
      hue: "#ffffff",
      name: "",
      placeholder: false,
      preview: { locked: "", open: "" },
      unlocked: true,
    })),
    panel: 2,
    ship: 2,
    stay: false,
  };
}

function galaxyConstructionOptions(): Parameters<typeof createGalaxyMap>[1] {
  return {
    labels: {
      ...destinationLabels,
      close: "Close",
      development: "",
      home: "Home",
      jump: "Jump",
      locked: "Locked",
      lockedAction: "Progress the story to unlock",
      number: "{number}",
      stay: "Stay",
    },
    now: () => performance.now(),
    onClose: vi.fn(),
    onEarth: vi.fn(),
    onFlightEnd: vi.fn(),
    onJump: vi.fn(),
    onStep: vi.fn(),
    onView: vi.fn(),
    reducedMotion: () => true,
  };
}

it.each(["1", "earth", "galaxy-jump", "galaxy-close-x"])(
  "rejects unbound Galaxy Map control %s before the hidden screen is mounted",
  (id) => {
    const fixture = dom();
    const options = galaxyConstructionOptions();
    const mount = vi.spyOn(fixture.host, "insertBefore");
    const bind = actionBinding.bindAdaAction;
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((action, element) =>
      (element.dataset.action ?? element.dataset.position) === id ||
      (id === "galaxy-jump" && action.ownAriaDisabled === "refusal-feedback")
        ? { activate: () => false, dispose() {}, update() {} }
        : bind(action, element),
    );

    expect(() => createGalaxyMap(fixture.host, options)).toThrow("no registered action binding");
    expect(mount).not.toHaveBeenCalled();
    expect(fixture.host.children.length).toBe(0);
    const actions = fixture.nodes.filter((node) => node.tag === "button");
    expect(actions).toHaveLength(9);
    for (const element of actions) {
      expect(element.isConnected).toBe(false);
      expect(element.listeners.get("click") ?? []).toEqual([]);
      expect(element.listeners.get("focus") ?? []).toEqual([]);
    }
    expect(options.onView).not.toHaveBeenCalled();
    expect(options.onJump).not.toHaveBeenCalled();
    expect(options.onEarth).not.toHaveBeenCalled();
  },
);

it("removes the hidden Galaxy Map if the mounted screen has no live action root", () => {
  const fixture = dom(false);
  const mount = vi.spyOn(fixture.host, "insertBefore");
  expect(() => createGalaxyMap(fixture.host, galaxyConstructionOptions())).toThrow(
    "no live action root",
  );
  expect(mount).toHaveBeenCalledOnce();
  expect(fixture.host.children.length).toBe(0);
  expect(fixture.nodes.find((node) => node.dataset.dialog === "galaxies")?.hidden).toBe(true);
});

it("checks all Galaxy Map controls in the attached hidden screen without reading runtime policy", () => {
  const fixture = dom();
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  const bind = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw new Error("construction read runtime action policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((action, element) =>
    bind({ ...action, click: { ...action.click, availability: policy }, current: policy }, element),
  );
  const map = createGalaxyMap(fixture.host, galaxyConstructionOptions());
  try {
    const screen = fixture.nodes.find((node) => node.dataset.dialog === "galaxies")!;
    expect(screen.hidden).toBe(true);
    expect(audit.mock.calls).toEqual([[screen]]);
    const primary = screen
      .querySelectorAll("button")
      .find((node) => node.dataset.action === "galaxy-jump")!;
    expect(screen.querySelectorAll("button")).toHaveLength(9);
    const view = mapView(null);
    map.show({
      ...view,
      galaxies: view.galaxies.map((galaxy) => ({ ...galaxy, unlocked: false })),
    });
    expect(primary.attributes.get("aria-disabled")).toBe("true");
    map.jump();
    map.show(null);
    expect(primary.isConnected).toBe(true);
    expect(audit).toHaveBeenCalledOnce();
    expect(policy).not.toHaveBeenCalled();
  } finally {
    map.dispose();
  }
});

it("binds Galaxy X once and withholds it during the unlock and quantum jump", () => {
  const fixture = dom();
  const options = galaxyConstructionOptions();
  const map = createGalaxyMap(fixture.host, options);
  const close = fixture.nodes.find((node) => node.dataset.action === "galaxy-close-x")!;
  const binding = resolveAdaHoldAction(fixture.host, close as unknown as HTMLElement)!;
  expect(close.className.split(" ")).toEqual(
    expect.arrayContaining(["ada-close", "ui-standard-button"]),
  );
  expect(close.attributes.get("aria-label")).toBe("Close");
  close.click();
  expect(options.onClose).not.toHaveBeenCalled();
  map.show({ ...mapView({ from: 1, opened: [2], to: 2 }), panel: 1, ship: 1 });
  expect(close.hidden).toBe(true);
  expect(binding.available()).toBe(false);
  close.click();
  expect(options.onFlightEnd).not.toHaveBeenCalled();
  expect(options.onClose).not.toHaveBeenCalled();
  map.show(null);
  map.show(mapView(null));
  expect(close.hidden).toBe(false);
  close.click();
  expect(options.onClose).toHaveBeenCalledOnce();
  map.jump();
  expect(close.hidden).toBe(true);
  expect(binding.available()).toBe(false);
  close.click();
  map.dispose();
  close.click();
  expect(options.onClose).toHaveBeenCalledOnce();
  expect(options.onJump).not.toHaveBeenCalled();
});

it.each(["Space", "pointer"])(
  "finishes the unlock once and admits a fresh native Enter after the %s skip",
  (kind) => {
    const fixture = dom();
    const options = galaxyConstructionOptions();
    const map = createGalaxyMap(fixture.host, options);
    const screen = fixture.nodes.find((node) => node.dataset.dialog === "galaxies")!;
    const jump = fixture.nodes.find((node) => node.dataset.action === "galaxy-jump")!;
    const capture = (type: string, properties = {}) => {
      const event = Object.assign(new Event(type, { cancelable: true }), properties);
      const handler = screen.listeners.get(type)![0] as (event: Event) => void;
      handler(event);
      return event;
    };
    const flight = { from: 1, opened: [2], to: 2 } as const;
    try {
      map.show({ ...mapView(flight), panel: 1, ship: 1 });
      if (kind === "Space") {
        expect(capture("keydown", { key: " ", repeat: false }).defaultPrevented).toBe(true);
        expect(capture("keydown", { key: " ", repeat: true }).defaultPrevented).toBe(true);
        expect(capture("keyup", { key: " " }).defaultPrevented).toBe(true);
      } else {
        expect(capture("pointerdown", { pointerId: 7 }).defaultPrevented).toBe(true);
        // The ancestor action root can stop the release click before this screen sees it.
      }
      expect(options.onFlightEnd).toHaveBeenCalledOnce();
      expect(options.onView).not.toHaveBeenCalled();
      expect(options.onStep).not.toHaveBeenCalled();
      expect(options.onJump).not.toHaveBeenCalled();
      expect(focusTarget).toHaveBeenLastCalledWith(jump);
      expect(capture("keydown", { key: "Enter", repeat: false }).defaultPrevented).toBe(false);
      const click = capture("click", { detail: 0 });
      if (!click.defaultPrevented) {
        jump.click();
      }
      expect(options.onJump).toHaveBeenCalledOnce();
      if (kind === "pointer") {
        expect(capture("click", { detail: 1, pointerId: 8 }).defaultPrevented).toBe(false);
        expect(capture("click", { detail: 1, pointerId: 7 }).defaultPrevented).toBe(true);
      }
      expect(options.onFlightEnd).toHaveBeenCalledOnce();
    } finally {
      map.dispose();
    }
  },
);

it("draws route thrust below the painted hull and hides it under reduced motion", () => {
  const fixture = dom();
  let reduced = false;
  const options = {
    labels: {
      ...destinationLabels,
      close: "Close",
      development: "",
      home: "",
      jump: "Jump",
      locked: "",
      lockedAction: "Progress the story to unlock",
      number: "{number}",
      stay: "",
    },
    now: () => performance.now(),
    onClose() {},
    onEarth() {},
    onFlightEnd() {},
    onJump() {},
    onStep() {},
    onView() {},
    reducedMotion: () => reduced,
  };
  const map = createGalaxyMap(fixture.host, options);
  const firstMarker = fixture.nodes.find((node) => node.dataset.position === "1")!;
  const earthMarker = fixture.nodes.find((node) => node.dataset.position === "earth")!;
  expect(earthMarker.className).toBe(firstMarker.className);
  expect(earthMarker.dataset).not.toBe(firstMarker.dataset);
  expect(earthMarker.querySelector(".ada-route-disc")).not.toBe(
    firstMarker.querySelector(".ada-route-disc"),
  );
  expect(earthMarker.querySelector(".ada-route-disc")!.textContent).toBe("");
  expect(firstMarker.querySelector(".ada-route-disc")!.textContent).toBe("1");
  expect(earthMarker.attributes.get("aria-label")).toBe("Earth");
  let normal = false;
  const normalMain = { ...main, ...apertureGeometry(main) };
  const legacyMain = { ...main, ...legacyGeometry(main) };
  const provider = vi.fn(() =>
    staticShipJets(normal ? normalMain : legacyMain, LIGHT_FIELD.jets.shipLevels, 3),
  );
  map.setArt({
    figures: [],
    ground: "",
    jets: provider,
    locked: "#888888",
    ship: () => Array.from({ length: 64 }, (_, heading) => `cobalt-${heading}.svg`),
    sky: "",
  });
  map.show(mapView({ from: 1, opened: [2], to: 2 }));
  fixture.tick(500);
  expect(drawShipJets).toHaveBeenCalled();
  expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(LIGHT_FIELD.jets.shipLevels[2]);
  const ship = fixture.nodes.find(({ className }) => className === "ada-route-ship")!;
  expect(ship.children[0]!.tag).toBe("canvas");
  expect(ship.children[1]!.style.backgroundImage).toContain("cobalt-");
  expect(ship.children[0]!.style.zIndex).toBe("");
  normal = true;
  fixture.tick(550);
  expect(ship.children[0]!.style.zIndex).toBe("1");
  normal = false;
  fixture.tick(575);
  expect(ship.children[0]!.style.zIndex).toBe("");
  const calls = vi.mocked(drawShipJets).mock.calls.length;
  reduced = true;
  fixture.tick(600);
  expect(vi.mocked(drawShipJets).mock.calls).toHaveLength(calls);
  expect(ship.children[0]!.hidden).toBe(true);
  map.dispose();
  expect(fixture.callbacks.size).toBe(0);
});

it.each([false, true])(
  "routes the Earth primary action through onEarth when atEarth is %s",
  (atEarth) => {
    const fixture = dom();
    const onClose = vi.fn();
    const onEarth = vi.fn();
    const map = createGalaxyMap(fixture.host, {
      labels: {
        ...destinationLabels,
        close: "Close",
        development: "",
        home: "Home",
        jump: "Jump",
        locked: "Locked",
        lockedAction: "Progress the story to unlock",
        number: "{number}",
        stay: "Stay",
      },
      now: () => performance.now(),
      onClose,
      onEarth,
      onFlightEnd() {},
      onJump() {},
      onStep() {},
      onView() {},
      reducedMotion: () => true,
    });
    map.show({ ...mapView(null), atEarth, stay: true });
    const primary = fixture.nodes.find((node) => node.dataset.action === "galaxy-jump")!;
    primary.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEarth).not.toHaveBeenCalled();
    fixture.nodes.find((node) => node.dataset.position === "earth")!.click();
    expect(primary.textContent).toBe(atEarth ? "Stay on Earth" : "Jump to Earth");
    primary.click();
    expect(onEarth).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    map.dispose();
  },
);

it.each(["mouse", "hold"])(
  "dispatches Galaxy Map selection once for %s and preserves navigation",
  (gesture) => {
    const fixture = dom();
    const initial = mapView(null);
    let view = {
      ...initial,
      galaxies: initial.galaxies.map((galaxy, index) => ({
        ...galaxy,
        unlocked: index !== 2,
      })),
    };
    const onView = vi.fn((position: RoutePosition) => {
      // The real scene applies the selection and refreshes show() synchronously.
      view = {
        ...view,
        panel: position,
        ship: view.galaxies[position - 1]!.unlocked ? position : view.ship,
      };
      map.show(view);
    });
    const onStep = vi.fn();
    const map = createGalaxyMap(fixture.host, { ...galaxyConstructionOptions(), onStep, onView });
    const marker = (position: number | "earth") =>
      fixture.nodes.find((node) => node.dataset.position === String(position))!;
    const focus = (node: ReturnType<typeof marker>) => {
      for (const callback of node.listeners.get("focus") ?? []) {
        callback();
      }
    };
    const currentTitle = () => fixture.nodes.find((node) => node.tag === "h2")!.textContent;
    try {
      map.show(view);
      const selected = () =>
        fixture.nodes
          .filter((node) => node.tag === "button" && node.attributes.has("data-selected"))
          .map((node) => node.dataset.position);
      expect(selected()).toEqual([String(initial.panel)]);
      for (const position of [1, 2, 3, 4, 5, 6, "earth"] as const) {
        expect(
          fixture.nodes.filter((node) => node.dataset.routeLabel === String(position)),
        ).toHaveLength(1);
        expect(marker(position).children.map(({ className }) => className)).toEqual([
          "ada-route-backing",
          "ada-route-disc",
        ]);
      }
      if (gesture === "mouse") {
        focus(marker(3));
        marker(3).click();
      } else {
        const hold = resolveAdaHoldAction(fixture.host, marker(3) as unknown as HTMLElement)!;
        expect(hold.available()).toBe(true);
        hold.activate();
        expect(onView.mock.calls).toEqual([[3]]);
        focus(marker(3));
      }
      expect(onView.mock.calls).toEqual([[3]]);
      expect(currentTitle()).toBe("3");
      const jump = fixture.nodes.find((node) => node.dataset.action === "galaxy-jump")!;
      expect(jump.attributes.get("aria-disabled")).toBe("true");
      expect(selected()).toEqual(["3"]);

      marker("earth").click();
      expect(selected()).toEqual(["earth"]);
      expect(currentTitle()).toBe(destinationLabels.earthKicker);
      focus(marker(3));
      marker(3).click();
      expect(onView.mock.calls).toEqual([[3], [3]]);
      expect(currentTitle()).toBe("3");

      const screen = fixture.nodes.find((node) => node.dataset.dialog === "galaxies")!;
      const navigate = screen.listeners.get("keydown")!.at(-1)!;
      navigate(Object.assign(new Event("keydown"), { key: "Tab", shiftKey: false }));
      expect(focusTarget).toHaveBeenLastCalledWith(marker(1));
      focus(marker(1));
      expect(onView.mock.calls).toEqual([[3], [3], [1]]);
      navigate(Object.assign(new Event("keydown"), { key: "ArrowRight", shiftKey: false }));
      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
    } finally {
      map.dispose();
    }
  },
);

it("registers native route actions once and releases selection callbacks on dispose", () => {
  const fixture = dom();
  const onView = vi.fn((panel: RoutePosition) => {
      map.show({ ...mapView(null), panel });
    }),
    onJump = vi.fn(),
    onEarth = vi.fn(),
    onClose = vi.fn();
  const map = createGalaxyMap(fixture.host, {
    labels: {
      ...destinationLabels,
      close: "Close",
      development: "",
      home: "Earth",
      jump: "Jump",
      locked: "...",
      lockedAction: "Progress the story to unlock",
      number: "Galaxy {number}",
      stay: "Stay",
    },
    now: () => performance.now(),
    onClose,
    onEarth,
    onFlightEnd() {},
    onJump,
    onStep() {},
    onView,
    reducedMotion: () => true,
  });
  map.show({ ...mapView(null), panel: 1 });
  const marker = fixture.nodes.find((node) => node.dataset.position === "2")!;
  const primary = fixture.nodes.find((node) => node.dataset.action === "galaxy-jump")!;
  const action = resolveAdaHoldAction(fixture.host, marker as unknown as HTMLElement)!;
  expect(action.available()).toBe(true);
  expect(action.hold).toBeUndefined();
  action.activate();
  expect(onView).toHaveBeenCalledExactlyOnceWith(2);
  for (const callback of marker.listeners.get("focus") ?? []) {
    callback();
  }
  expect(onView).toHaveBeenCalledOnce();
  const jump = resolveAdaHoldAction(fixture.host, primary as unknown as HTMLElement)!;
  jump.activate();
  expect(onJump).toHaveBeenCalledOnce();
  fixture.nodes.find((node) => node.dataset.position === "earth")!.click();
  jump.activate();
  expect(onEarth).toHaveBeenCalledOnce();
  map.show(null);
  expect(action.available()).toBe(false);
  map.show({ ...mapView(null), stay: true });
  jump.activate();
  expect(onClose).toHaveBeenCalledOnce();
  map.dispose();
  expect(action.available()).toBe(false);
  action.activate();
  marker.click();
  for (const callback of marker.listeners.get("focus") ?? []) {
    callback();
  }
  expect(onView).toHaveBeenCalledOnce();
  expect(resolveAdaHoldAction(fixture.host, primary as unknown as HTMLElement)).toBeNull();
});
