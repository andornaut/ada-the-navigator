// Test support: text widths in the UI's sans-serif, so layout tests can check that copy fits.

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

/** A text's width at size px in Liberation Sans of weight. */
export function measure(text: string, size: number, weight: "bold" | "regular"): number {
  return [...text].reduce((sum, char) => {
    const width = WIDTHS[weight][char];
    if (width === undefined) {
      throw new Error(`No width for ${JSON.stringify(char)}`);
    }
    return sum + (width * size) / 1000;
  }, 0);
}

// Greedy wrapping at spaces, as the browser wraps: the measure for each line from its top.
export function lineCount(
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
