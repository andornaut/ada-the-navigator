import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import data from "../../public/art/quantum-jump.json";
import mainData from "../../public/art/ship-jets.json";
import { LIGHT_FIELD } from "../game/lightField.ts";
import { type QuantumJump, readQuantumJump } from "../game/quantumJump.ts";
import { readEngineJets } from "../game/shipJets.ts";
import { staticShipJets } from "../game/staticShipJets.ts";
import { createGalaxyMap, type GalaxyMapView } from "./galaxyMap.ts";
import { createJumpOverlay, type SheetArt } from "./jumpOverlay.ts";
import { drawShipJets } from "./shipJetCanvas.ts";

const events = vi.hoisted(() => [] as string[]);
vi.mock("./shipJetCanvas.ts", () => ({ drawShipJets: vi.fn(() => events.push("jets")) }));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({ focusTarget: vi.fn() }));

const main = readEngineJets(mainData)!;
const display = { height: 64, width: 64 };
const sheet: SheetArt = {
  ...display,
  frameHeight: 64,
  frameWidth: 64,
  frames: {},
  url: "sheet.svg",
};

function dom() {
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
    children: ElementFake[] = [];
    className = "";
    classList = { add() {}, remove() {}, toggle() {} };
    clientHeight = 540;
    clientWidth = 960;
    dataset: Record<string, string> = {};
    height = 0;
    hidden = false;
    style = { backgroundImage: "", removeProperty() {}, setProperty() {} };
    width = 0;
    readonly tag: string;
    constructor(tag: string) {
      this.tag = tag;
      nodes.push(this);
    }
    addEventListener() {}
    append(...elements: ElementFake[]) {
      this.children.push(...elements);
    }
    getContext() {
      return context;
    }
    remove() {}
    removeAttribute() {}
    replaceChildren(...elements: ElementFake[]) {
      this.children = elements;
    }
    setAttribute() {}
    toggleAttribute() {}
  }
  const document = {
    createElement: (tag: string) => new ElementFake(tag),
    createElementNS: (_namespace: string, tag: string) => new ElementFake(tag),
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
  return {
    callbacks,
    host: new ElementFake("host") as unknown as HTMLElement,
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
    const overlay = createJumpOverlay(fixture.host, {
      field: sheet,
      glow: sheet,
      jump: effect(),
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
    expect(vi.mocked(drawShipJets).mock.lastCall![1].layers).toBe(LIGHT_FIELD.jets.shipLevels[1]);
    expect(running.onCover).toHaveBeenCalledTimes(1);
    overlay.dispose();
    expect(fixture.callbacks.size).toBe(0);
  });

  it.each([false, true])(
    "keeps coast and reduced-motion draws jet-free (reduced %s)",
    (reduced) => {
      const fixture = dom();
      const overlay = createJumpOverlay(fixture.host, {
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

it("draws route thrust below the painted hull and hides it under reduced motion", () => {
  const fixture = dom();
  let reduced = false;
  const options = {
    labels: {
      close: "",
      development: "",
      home: "",
      jump: "",
      locked: "",
      number: "{number}",
      stay: "",
    },
    onClose() {},
    onEarth() {},
    onFlightEnd() {},
    onJump() {},
    onStep() {},
    onView() {},
    reducedMotion: () => reduced,
  };
  const map = createGalaxyMap(fixture.host, options);
  const provider = vi.fn(() => staticShipJets(main, LIGHT_FIELD.jets.shipLevels, 3));
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
  const calls = vi.mocked(drawShipJets).mock.calls.length;
  reduced = true;
  fixture.tick(600);
  expect(vi.mocked(drawShipJets).mock.calls).toHaveLength(calls);
  expect(ship.children[0]!.hidden).toBe(true);
  map.dispose();
  expect(fixture.callbacks.size).toBe(0);
});
