import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../../data/prototype.ts";
import { type Background, BACKGROUND_ART } from "../../data/storybook.ts";
import { GameModel } from "../../model/game.ts";
import {
  boardingScene,
  jumpHomeScene,
  openingScene,
  prologueScene,
  resolutionScene,
  roomScene,
  type StoryPage,
} from "../../model/storybook.ts";
import { STORY_BUTTON } from "./controls.ts";
import {
  hudRect,
  type Insets,
  type Size,
  STORY_PANEL_TOP,
  STORY_ROOM_PANEL_TOP,
} from "./playView.ts";
import {
  STORY_PANEL,
  storyBackgroundTop,
  storyChoiceWidth,
  storyPanelLayout,
  type SubjectBand,
} from "./storyPage.ts";
import { SMALL_BUTTON_GAP, SPACING, TYPE } from "./tokens.ts";

// Liberation Sans advance widths per 1000 em, metric-compatible with Arial and Helvetica, for the
// characters Gameplay's copy uses: regular for the story text, bold for headings and labels.
const WIDTHS: Readonly<Record<"bold" | "regular", Readonly<Record<string, number>>>> = {
  bold: {
    " ": 278,
    "!": 333,
    "'": 238,
    ",": 278,
    "-": 333,
    ".": 278,
    ":": 333,
    ";": 333,
    "?": 611,
    A: 722,
    B: 722,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 556,
    K: 722,
    L: 611,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611,
    a: 556,
    b: 611,
    c: 556,
    d: 611,
    e: 556,
    f: 333,
    g: 611,
    h: 611,
    i: 278,
    j: 278,
    k: 556,
    l: 278,
    m: 889,
    n: 611,
    o: 611,
    p: 611,
    q: 611,
    r: 389,
    s: 556,
    t: 333,
    u: 611,
    v: 556,
    w: 778,
    x: 556,
    y: 556,
    z: 500,
  },
  regular: {
    " ": 278,
    "!": 278,
    "'": 191,
    ",": 278,
    "-": 333,
    ".": 278,
    ":": 278,
    ";": 278,
    "?": 556,
    A: 667,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 500,
    K: 667,
    L: 556,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611,
    a: 556,
    b: 556,
    c: 500,
    d: 556,
    e: 556,
    f: 278,
    g: 556,
    h: 556,
    i: 222,
    j: 222,
    k: 500,
    l: 222,
    m: 833,
    n: 556,
    o: 556,
    p: 556,
    q: 556,
    r: 333,
    s: 500,
    t: 278,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 500,
  },
};
for (const digit of "0123456789") {
  (WIDTHS.bold as Record<string, number>)[digit] = 556;
  (WIDTHS.regular as Record<string, number>)[digit] = 556;
}

function measure(text: string, size: number, weight: "bold" | "regular"): number {
  return [...text].reduce((sum, char) => {
    const width = WIDTHS[weight][char];
    if (width === undefined) {
      throw new Error(`No width for ${JSON.stringify(char)}`);
    }
    return sum + (width * size) / 1000;
  }, 0);
}

// Greedy wrapping at spaces, as the browser wraps: the measure for each line from its top.
function lineCount(
  text: string,
  size: number,
  weight: "bold" | "regular",
  measureAt: (line: number) => number,
): number {
  const words = text.split(" ");
  let lines = 1;
  let line = "";
  for (const word of words) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(candidate, size, weight) > measureAt(lines - 1)) {
      lines += 1;
      line = word;
    } else {
      line = candidate;
    }
  }
  return lines;
}

const PORTRAITS = new Set(["Ada", "Astra", "Penny", "Unknown voice", "General Gadget"]);
const { frame } = STORY_PANEL.portrait;
// The portrait floats with a row gap below it: the lines beside it are shorter.
const FLOAT_BOTTOM = frame + SPACING.rowGap;

/** The text column's height: the heading, the tab and portrait, then the paragraph. */
function textHeight(page: StoryPage, width: number): number {
  let y = 0;
  if (page.heading) {
    expect(measure(page.heading, TYPE.heading.size, "bold")).toBeLessThanOrEqual(width);
    y += TYPE.heading.lineHeight + SPACING.gap;
  }
  const portrait = page.speaker !== undefined && PORTRAITS.has(page.speaker);
  if (page.speaker) {
    y += 20 + SPACING.gap;
  }
  const top = y;
  const narrow = width - frame - SPACING.gap;
  const lines = lineCount(page.text, TYPE.story.size, "regular", (line) =>
    portrait && top + line * TYPE.story.lineHeight < FLOAT_BOTTOM ? narrow : width,
  );
  const height = y + lines * TYPE.story.lineHeight;
  return portrait ? Math.max(height, FLOAT_BOTTOM) : height;
}

/** A story button's height for a label in a face width: 36, growing a label line per line. */
function buttonHeight(label: string, width: number): number {
  const lines = lineCount(label, TYPE.label.size, "bold", () => width - 2 * STORY_BUTTON.inset);
  return STORY_BUTTON.height + (lines - 1) * TYPE.label.lineHeight;
}

/** The choice column's height: choices, a full-row named action, then the page controls. */
function choiceHeight(page: StoryPage, width: number): number {
  const labels = (page.choices ?? page.questions ?? []).map(({ label }) => label);
  expect(labels.length).toBeLessThanOrEqual(3);
  const half = (width - SMALL_BUTTON_GAP) / 2;
  const parts = labels.map((label) => buttonHeight(label, width));
  if (
    page.action &&
    measure(page.action, TYPE.label.size, "bold") + 2 * STORY_BUTTON.inset > half
  ) {
    parts.push(buttonHeight(page.action, width));
  }
  parts.push(STORY_BUTTON.height);
  return parts.reduce((sum, part) => sum + part, 0) + (parts.length - 1) * SMALL_BUTTON_GAP;
}

interface Screen {
  readonly insets: Insets;
  readonly name: string;
  readonly view: Size;
}
const PHONE = { bottom: 19, left: 43, right: 43, top: 0 };
const NONE = { bottom: 0, left: 0, right: 0, top: 0 };
// Art's four screens, as logical views and logical insets (art/layout.md "Storybook page").
const SCREENS: readonly Screen[] = [
  { insets: PHONE, name: "720x360, insets", view: { height: 360, width: 720 } },
  { insets: PHONE, name: "844x390, insets", view: { height: 360, width: (844 * 360) / 390 } },
  { insets: NONE, name: "844x390", view: { height: 360, width: (844 * 360) / 390 } },
  { insets: NONE, name: "1280x720", view: { height: 405, width: 720 } },
];

/** The panel's height and top for a page on a screen, and its top cap there. */
function panelFor(page: StoryPage, screen: Screen) {
  const layout = storyPanelLayout(screen.insets, screen.view);
  const height =
    2 * STORY_PANEL.padding +
    Math.max(textHeight(page, layout.text.width), choiceHeight(page, layout.choice.width));
  const cap =
    hudRect(screen.insets, screen.view).y +
    (page.id === "room" ? STORY_ROOM_PANEL_TOP : STORY_PANEL_TOP);
  return { cap, height, top: layout.bottom - height };
}

const labels = {
  continue: PROTOTYPE.labels.continue ?? "",
  pickUpRock: PROTOTYPE.labels.pickUpRock ?? "",
};
const galaxies = [1, 2, 3] as const;
// Every page of Gameplay's copy, once: each chapter's opening and resolution, the first
// launch's garden framing, the prologue, Ada's room, boarding and the jump home.
const PAGES: readonly StoryPage[] = [
  ...new Map(
    [
      ...galaxies.flatMap((galaxy) => [
        openingScene(PROTOTYPE, galaxy, galaxy === 1),
        ...(galaxy === 1 ? [openingScene(PROTOTYPE, galaxy)] : []),
        resolutionScene(PROTOTYPE, galaxy),
      ]),
      prologueScene(PROTOTYPE, labels),
      roomScene(PROTOTYPE, labels, false),
      roomScene(PROTOTYPE, labels, true),
      boardingScene(PROTOTYPE, false),
      boardingScene(PROTOTYPE, true),
      jumpHomeScene(PROTOTYPE.labels.jumpHome ?? "", PROTOTYPE.labels.morningRecharge ?? ""),
    ]
      .flatMap(({ pages }) => pages)
      .filter(({ sleep, text }) => !sleep && text !== "")
      .map((page) => [`${page.background}|${page.speaker ?? ""}|${page.text}`, page] as const),
  ).values(),
];

describe("story panel layout", () => {
  it("places the panel and its columns as Art's storybook rects", () => {
    const rows = SCREENS.map((screen) => {
      const { bottom, choice, panel, rule, text } = storyPanelLayout(screen.insets, screen.view);
      return [panel.x, panel.width, bottom, text.x, text.width, rule, choice.x, choice.width];
    });
    const expected = [
      [43, 634, 341, 59, 349, 420, 433, 228],
      [43, 693.08, 341, 59, 394.37, 465.37, 478.37, 241.71],
      [16, 747.08, 344, 32, 427.85, 471.85, 484.85, 262.23],
      [16, 688, 389, 32, 391.22, 435.22, 448.22, 239.78],
    ];
    rows.forEach((row, index) => {
      row.forEach((value, column) => {
        expect(value, `${SCREENS[index]!.name} column ${column}`).toBeCloseTo(
          expected[index]![column]!,
          1,
        );
      });
    });
  });

  it("clamps the choice column between 228 and 300", () => {
    expect(storyChoiceWidth(400)).toBe(228);
    expect(storyChoiceWidth(1000)).toBe(300);
    expect(storyChoiceWidth(661.08)).toBeCloseTo(241.71, 2);
  });
});

describe("story text fit", () => {
  it("counts each distinct page once: the scene pages and the overnight recharge's three", () => {
    // A page is its scene slot: a room or boarding page with two texts (the empty visit's
    // room, a new galaxy's welcome) counts each text, and chapter one's opening counts once.
    const distinct = (scenes: readonly { pages: readonly StoryPage[] }[]) =>
      new Set(
        scenes
          .flatMap(({ pages }) => pages)
          .map((page) => `${page.background}|${page.speaker ?? ""}|${page.text}`),
      ).size;
    const chapters = galaxies.flatMap((galaxy) => [
      openingScene(PROTOTYPE, galaxy, galaxy === 1),
      ...(galaxy === 1 ? [openingScene(PROTOTYPE, galaxy)] : []),
      resolutionScene(PROTOTYPE, galaxy),
    ]);
    const counts = {
      boarding: distinct([boardingScene(PROTOTYPE, false), boardingScene(PROTOTYPE, true)]),
      chapters: distinct(chapters),
      overnight: jumpHomeScene("night", "morning").pages.length,
      prologue: distinct([prologueScene(PROTOTYPE, labels)]),
      room: distinct([roomScene(PROTOTYPE, labels, false), roomScene(PROTOTYPE, labels, true)]),
    };
    // Chapters: Grandma's garden framing (4 arrival pages and her farewell) round chapter one's
    // opening, each opening and resolution with its two branches, and each closing. The prologue:
    // 23 lines with Miso and Pepper, and Astra's 3 answers.
    expect(counts).toEqual({ boarding: 3, chapters: 26, overnight: 3, prologue: 26, room: 2 });
    // 57 scene pages and the overnight 3, of which the sleep scene has no text.
    expect(PAGES).toHaveLength(57 + 2);
  });

  it("fits every page under the top cap at every screen, so none scrolls", () => {
    for (const screen of SCREENS) {
      for (const page of PAGES) {
        const { cap, top } = panelFor(page, screen);
        expect(top, `${screen.name}: ${page.text}`).toBeGreaterThanOrEqual(cap);
      }
    }
  });

  it("sizes the pages of Art's card table", () => {
    const opening = PAGES.find(
      ({ id, text }) => id === "opening" && text === PROTOTYPE.chapters[1].opening,
    )!;
    const longest = PAGES.reduce((a, b) => (b.text.length > a.text.length ? b : a));
    expect(longest).toBe(opening);
    const questions = PAGES.find(({ questions }) => questions)!;
    const heights = (page: StoryPage) => SCREENS.map((screen) => panelFor(page, screen).height);
    expect(heights(opening)).toEqual([228, 228, 208, 228]);

    expect(heights(questions)).toEqual([248, 248, 248, 248]);
    expect(SCREENS.map((screen) => panelFor(questions, screen).top)).toEqual([93, 93, 96, 141]);
  });
});

describe("Gameplay's limits", () => {
  it("keep every label of a three-choice page on one line at the narrowest choice column", () => {
    const narrowest = STORY_PANEL.choiceColumn.min;
    const three = PAGES.filter((page) => (page.choices ?? page.questions ?? []).length === 3);
    expect(three.length).toBeGreaterThan(0);
    for (const page of three) {
      for (const { label } of page.choices ?? page.questions ?? []) {
        expect(buttonHeight(label, narrowest), label).toBe(STORY_BUTTON.height);
      }
    }
  });

  it("fit a page at the three-choice limit: 220 characters, the heading and three 23s", () => {
    const words = "Ada and Penny take the long way home past the garden gate".split(" ");
    let text = "";
    for (let index = 0; text.length < 220; index++) {
      text = `${text} ${words[index % words.length]}`.trim();
    }
    const page: StoryPage = {
      background: "grandmaGarden",
      choices: ["Ask what each one needs", "Help Grandma plant seed", "Meet the new organizer"].map(
        (label) => {
          expect(label.length).toBeLessThanOrEqual(23);
          return { label, next: "x" };
        },
      ),
      heading: "The Glowing Rock.",
      id: "opening",
      text: text.slice(0, 220),
    };
    for (const screen of SCREENS) {
      const { cap, top } = panelFor(page, screen);
      expect(top, screen.name).toBeGreaterThanOrEqual(cap);
    }
  });

  it("fit a chapter page at the limit: 220 characters, the heading and two 36 choices", () => {
    const words = "Ada and Penny take the long way home past the garden gate".split(" ");
    let text = "";
    for (let index = 0; text.length < 220; index++) {
      text = `${text} ${words[index % words.length]}`.trim();
    }
    const page: StoryPage = {
      background: "grandmaGarden",
      choices: [0, 1].map((index) => ({
        label: `Ask Grandma about the seed packet ${index}`.slice(0, 36),
        next: "x",
      })),
      heading: "The Glowing Rock.",
      id: "opening",
      text: text.slice(0, 220),
    };
    for (const screen of SCREENS) {
      const { cap, top } = panelFor(page, screen);
      expect(top, screen.name).toBeGreaterThanOrEqual(cap);
    }
  });
});

const MANIFEST = JSON.parse(
  readFileSync(new URL("../../../public/art/manifest.json", import.meta.url), "utf8"),
) as { assets: { id: string; subject?: SubjectBand }[] };
const subject = (key: Background) =>
  MANIFEST.assets.find(({ id }) => id === BACKGROUND_ART[key])!.subject!;

describe("story background placement", () => {
  it("centres each background's subject band in the strip above the panel, clamped to cover", () => {
    const [phone, , , desktop] = SCREENS;
    const top = (screen: Screen, key: Background, strip: number) =>
      storyBackgroundTop(screen.view, subject(key), strip);
    expect(top(phone!, "grandmaGarden", 113)).toBe(-180);
    expect(top(desktop!, "grandmaGarden", 161)).toBe(-135);
    expect(top(phone!, "park", 229)).toBe(-138);
    expect(top(SCREENS[1]!, "park", 237)).toBe(-134);
    expect(top(desktop!, "park", 285)).toBe(-110);
    expect(top(phone!, "cockpitSeated", 203)).toBe(-135);
    expect(top(desktop!, "cockpitSeated", 251)).toBe(-111);
    expect(top(phone!, "adaRoomNight", 257)).toBe(-146.5);
    expect(top(desktop!, "adaRoomNight", 305)).toBe(-122.5);
    // A backdrop without a panel centres.
    expect(storyBackgroundTop(phone!.view, null, null)).toBe(-90);
  });

  it("anchors the first launch's run on its tallest page on each background", () => {
    const model = new GameModel(PROTOTYPE);
    model.start();
    const run = model.storyView!.run.pages;
    const tops = (screen: Screen) => {
      const highest = new Map<Background, number>();
      for (const page of run.filter(({ sleep }) => !sleep)) {
        const { top } = panelFor(page, screen);
        highest.set(page.background, Math.min(highest.get(page.background) ?? top, top));
      }
      return Object.fromEntries(highest);
    };
    // Art's placement table: the run's panel tops at 720x360 with insets and at 1280x720.
    expect(tops(SCREENS[0]!)).toEqual({
      adaRoom: 213,
      adaRoomUnpolished: 231,
      cockpit: 93,
      cockpitSeated: 203,
      grandmaGarden: 113,
      park: 229,
    });
    expect(tops(SCREENS[3]!)).toEqual({
      adaRoom: 261,
      adaRoomUnpolished: 279,
      cockpit: 141,
      cockpitSeated: 251,
      grandmaGarden: 161,
      park: 285,
    });
  });
});
