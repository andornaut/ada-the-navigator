import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  advance,
  boardingScene,
  currentPage,
  goBack,
  jumpHomeScene,
  openingScene,
  prologueScene,
  roomScene,
  type Scene,
  shownChoices,
  type StoryPosition,
  storyStart,
} from "./storybook.ts";
import { readStoryCursor, storyCursor, type StorySceneReference } from "./storyCursor.ts";

const labels = { continue: CONTENT.labels.continue!, pickUpRock: CONTENT.labels.pickUpRock! };
const key = (ref: StorySceneReference) =>
  JSON.stringify([ref.id, ref.variant ?? null, ref.background ?? null]);
function fixture() {
  const references = new Map<Scene, StorySceneReference>();
  const scenes = new Map<string, Scene>();
  const add = (scene: Scene, ref: StorySceneReference) => {
    references.set(scene, ref);
    scenes.set(key(ref), scene);
    return scene;
  };
  const opening = add(openingScene(CONTENT, 1), { id: "opening:1" });
  const first = add(openingScene(CONTENT, 1, true), { id: "opening:1", variant: "firstLaunch" });
  const prologue = add(prologueScene(CONTENT, labels), { id: "prologue" });
  const boarding = add(boardingScene(CONTENT, false), { id: "boarding" });
  const announce = add(boardingScene(CONTENT, true), { id: "boarding", variant: "announce" });
  const rooms = (["adaRoom", "adaRoomMorningCats", "adaRoomNight"] as const).map((background) =>
    add(roomScene(CONTENT, labels, false, background), { background, id: "room" }),
  );
  const jump = add(jumpHomeScene(CONTENT.labels.jumpHome!, CONTENT.labels.morningRecharge!), {
    id: "jumpHome",
  });
  const lost = add(
    jumpHomeScene(
      `${CONTENT.labels.jumpHome!}\n${CONTENT.labels.jumpHomeOreLost!}`,
      CONTENT.labels.morningRecharge!,
    ),
    { id: "jumpHome", variant: "oreLost" },
  );
  const reference = (scene: Scene) => references.get(scene)!;
  const resolve = vi.fn((ref: StorySceneReference) => scenes.get(key(ref)) ?? null);
  return { announce, boarding, first, jump, lost, opening, prologue, reference, resolve, rooms };
}
const encoded = (f: ReturnType<typeof fixture>, position: StoryPosition) =>
  JSON.parse(JSON.stringify(storyCursor(f, position)));

describe("canonical story cursors", () => {
  it("round-trips a real unresolved choice without selecting it or embedding its authored scene", () => {
    const f = fixture();
    const position = { ...storyStart(f.first), page: "opening" };
    const before = JSON.stringify(position);
    const cursor = encoded(f, position);
    const decoded = readStoryCursor(f, cursor)!;
    expect(decoded).not.toBeNull();
    expect(decoded.scene).toBe(f.first);
    expect(currentPage(decoded).choices).toEqual(
      CONTENT.chapters[1]!.openingChoices.map((label, index) => ({
        label,
        next: `opening:branch:${index}`,
      })),
    );
    expect(decoded.page).toBe("opening");
    expect(decoded.asked).toEqual([]);
    expect(decoded.trail).toEqual([]);
    expect(JSON.stringify(position)).toBe(before);
    expect(Object.keys(cursor).sort()).toEqual(["current", "trail", "version"]);
    expect(Object.keys(cursor.current.scene).sort()).toEqual(["id", "variant"]);
    expect(JSON.stringify(cursor)).not.toContain(currentPage(position).text);
    expect(cursor.current.scene.effect).toBeUndefined();
  });

  it("preserves explicit branch, optional-question history and Previous across scene boundaries", () => {
    const f = fixture();
    const choice = { ...storyStart(f.opening), page: "opening" };
    const branch = advance(choice, 1)!;
    let question = storyStart(f.prologue, [
      ...branch.trail,
      { asked: branch.asked, page: branch.page, scene: branch.scene },
    ]);
    while (!currentPage(question).questions?.length) {
      question = advance(question)!;
    }
    const answer = advance(question, 0)!;
    const returned = advance(answer)!;
    expect(returned.asked).toHaveLength(1);
    const cursor = encoded(f, returned);
    const decoded = readStoryCursor(f, cursor)!;
    expect(decoded).toEqual(returned);
    expect(shownChoices(decoded)).toEqual(shownChoices(returned));
    expect(goBack(decoded).page).toBe(answer.page);
    expect(goBack(decoded).scene).toBe(f.prologue);
    expect(decoded.trail[0]!.scene).toBe(f.opening);
    expect(f.resolve.mock.calls.filter(([ref]) => ref.id === "prologue")).toHaveLength(1);
  });

  it("preserves every declared factory variant, including different references with the same scene id", () => {
    const f = fixture();
    const variants = [f.opening, f.first, f.boarding, f.announce, ...f.rooms, f.jump, f.lost];
    for (const scene of variants) {
      const position = storyStart(scene);
      const decoded = readStoryCursor(f, encoded(f, position))!;
      expect(decoded.scene).toBe(scene);
      expect(currentPage(decoded)).toEqual(currentPage(position));
    }
    const position = storyStart(f.announce, [
      { asked: [], page: f.boarding.pages[0]!.id, scene: f.boarding },
    ]);
    const decoded = readStoryCursor(f, encoded(f, position))!;
    expect(decoded.scene).toBe(f.announce);
    expect(decoded.trail[0]!.scene).toBe(f.boarding);
  });

  it.each([
    [
      "unknown scene",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.id = "missing";
      },
    ],
    [
      "unknown page",
      (value: ReturnType<typeof encoded>) => {
        value.current.page = "missing";
      },
    ],
    [
      "unknown asked target",
      (value: ReturnType<typeof encoded>) => {
        value.current.asked = ["missing"];
      },
    ],
    [
      "non-question target",
      (value: ReturnType<typeof encoded>) => {
        value.current.asked = [value.current.page];
      },
    ],
    [
      "unknown variant",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.variant = "other";
      },
    ],
    [
      "unsupported factory combination",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.variant = "oreLost";
      },
    ],
    [
      "unknown lighting",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.background = "aboard";
      },
    ],
    [
      "unsupported lighting combination",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.background = "adaRoom";
      },
    ],
    [
      "embedded scene",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.pages = [];
      },
    ],
    [
      "root extra key",
      (value: ReturnType<typeof encoded>) => {
        value.effect = { kind: "prologue" };
      },
    ],
    [
      "step extra key",
      (value: ReturnType<typeof encoded>) => {
        value.current.text = "authored text";
      },
    ],
    [
      "unknown trail page",
      (value: ReturnType<typeof encoded>) => {
        value.trail = [{ ...value.current, page: "missing" }];
      },
    ],
    [
      "version",
      (value: ReturnType<typeof encoded>) => {
        value.version = 2;
      },
    ],
    [
      "sparse trail",
      (value: ReturnType<typeof encoded>) => {
        value.trail = Array(1);
      },
    ],
    [
      "explicit undefined variant",
      (value: ReturnType<typeof encoded>) => {
        value.current.scene.variant = undefined;
      },
    ],
  ] as const)("rejects %s without a partial restore", (_, mutate) => {
    const f = fixture();
    const value = encoded(f, storyStart(f.opening));
    mutate(value);
    expect(readStoryCursor(f, value)).toBeNull();
  });

  it("rejects duplicate asked targets and overlong trails using resolved canonical bounds", () => {
    const f = fixture();
    const question = f.prologue.pages.find((page) => page.questions?.length)!;
    const position = { ...storyStart(f.prologue), page: question.id };
    const value = encoded(f, position);
    const target = question.questions![0]!.next!;
    value.current.asked = [target, target];
    expect(readStoryCursor(f, value)).toBeNull();
    value.current.asked = [];
    const capacity =
      f.prologue.pages.length +
      f.prologue.pages.reduce(
        (sum, page) =>
          sum + (page.questions?.filter((question) => question.next !== undefined).length ?? 0),
        0,
      );
    value.trail = Array.from({ length: capacity + 1 }, () => ({ ...value.current }));
    expect(readStoryCursor(f, value)).toBeNull();
    expect(
      f.resolve.mock.calls.filter(([ref]) => ref.id === "prologue").length,
    ).toBeLessThanOrEqual(2);
  });

  it("rejects accessors, symbols and custom prototypes without reading accessors", () => {
    const f = fixture();
    const getter = vi.fn(() => "opening:1");
    const accessor = encoded(f, storyStart(f.opening));
    Object.defineProperty(accessor.current.scene, "id", { enumerable: true, get: getter });
    expect(readStoryCursor(f, accessor)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const symbol = encoded(f, storyStart(f.opening));
    symbol[Symbol("hidden")] = true;
    expect(readStoryCursor(f, symbol)).toBeNull();
    const custom = encoded(f, storyStart(f.opening));
    Object.setPrototypeOf(custom.current, { extra: true });
    expect(readStoryCursor(f, custom)).toBeNull();
    const array = encoded(f, storyStart(f.opening));
    array.trail.extra = true;
    expect(readStoryCursor(f, array)).toBeNull();
    const arrayAccessor = encoded(f, storyStart(f.opening));
    Object.defineProperty(arrayAccessor.current.asked, "0", { enumerable: true, get: getter });
    expect(readStoryCursor(f, arrayAccessor)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects resolver failures or mismatched canonical identities and copies serialized navigation arrays", () => {
    const f = fixture();
    const position = storyStart(f.opening);
    const cursor = storyCursor(f, position);
    expect(
      readStoryCursor(
        {
          resolve: () => {
            throw new Error("unsupported reference");
          },
        },
        cursor,
      ),
    ).toBeNull();
    expect(readStoryCursor({ resolve: () => f.prologue }, cursor)).toBeNull();
    expect(cursor.current.asked).not.toBe(position.asked);
    expect(cursor.trail).not.toBe(position.trail);
    expect(() => storyCursor({ reference: () => ({ id: "missing" }) }, position)).toThrow(
      RangeError,
    );
  });
});
