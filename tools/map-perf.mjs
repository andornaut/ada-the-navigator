// Dedicated map interaction timings. Run in the isolated Playwright container against a local
// Vite server with HMR and file watching disabled. Measures forced DOM/raster completion, not FPS.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire("/app/package.json")("playwright");
if (process.getuid() !== 19001) {
  throw new Error("Map profiling requires the isolated UID 19001 browser container");
}
const origin = new URL(process.argv[2] ?? "http://map-perf:4173");
if (!["map-perf", "ada-preview", "localhost", "127.0.0.1"].includes(origin.hostname)) {
  throw new Error("Map profiling requires a local isolated preview");
}
const browser = await chromium.launch({
  channel: "chromium",
  headless: true,
  args: ["--no-sandbox"],
});
mkdirSync("/tmp/evidence", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => console.log(m.text()));
  await page.goto(new URL("/art/ui/icons/map-station.svg", origin).href);
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.evaluate(async () => {
    const { createMapScreen, mapScreenLabels } = await import("/src/ui/mapScreen.ts");
    const { CONTENT } = await import("/src/data/content.ts");
    const { UI_STYLESHEET } = await import("/src/ui/stylesheet.ts");
    const style = document.createElement("style");
    style.textContent = `${UI_STYLESHEET}
      html,body{margin:0;width:100%;height:100%;overflow:hidden}
      .ada-controls{position:absolute;inset:0;--ada-unit:1;
        --ada-safe-left:0px;--ada-safe-right:0px;--ada-safe-top:0px;--ada-safe-bottom:0px}
    `;
    document.head.append(style);
    const root = document.createElement("div");
    root.className = "ada-controls";
    document.body.append(root);
    const explored = [];
    for (let x = -10; x < 10; x++) {
      for (let y = -10; y < 10; y++) {
        explored.push({ x: (x + 0.5) * 512, y: (y + 0.5) * 512 });
      }
    }
    const symbols = [
      "station",
      "growers",
      "workshop",
      "salvagers",
      "nebula",
      "wreck",
      "beacon",
      "holodisk",
    ];
    const places = Array.from({ length: 36 }, (_, i) => ({
      id: `place:${i}`,
      label: `Mapped place ${i}`,
      kind: i % 3 === 0 ? "landmark" : "station",
      symbol: symbols[i % symbols.length],
      job: i === 3,
      objective: i === 1,
      travel: i % 3 !== 0,
      x: Math.cos(i * 2.399) * (2000 + i * 500),
      y: Math.sin(i * 2.399) * (2000 + i * 500),
    }));
    const state = {
      field: { background: "#d8c994", fog: "#8d825f", name: "Sunflower" },
      inDanger: false,
      carrying: false,
      towing: false,
      job: "Survey a mapped landmark",
      map: {
        explored,
        places,
        player: { x: 200, y: 100 },
        facing: { x: 1, y: 0 },
        landmarks: { charted: 12, total: 12 },
        mapped: 60,
        quests: [],
        searchArea: { x: 4000, y: 2500, radius: 900 },
      },
    };
    const map = createMapScreen(root, {
      labels: mapScreenLabels(CONTENT.labels),
      onClose() {},
      onGalaxies() {},
      onTravel() {},
      reducedMotion: () => true,
    });
    map.setState(state);
    map.open();
    // Synthetic pointer events are routed directly to the actual map handlers, so native capture is unnecessary.
    map.element.setPointerCapture = () => {};
    window.mapPerf = { map, state, ready: true };
  });
  await page.evaluate(() => document.fonts.ready);
  const results = await page.evaluate(async () => {
    const screen = window.mapPerf.map.element,
      canvas = screen.querySelector("canvas"),
      ctx = canvas.getContext("2d");
    const proto = CanvasRenderingContext2D.prototype,
      fill = proto.fill;
    let fills = 0,
      fillMs = 0;
    proto.fill = function (...args) {
      const start = performance.now();
      const out = fill.apply(this, args);
      fillMs += performance.now() - start;
      fills++;
      return out;
    };
    const pointer = (type, x, y) =>
      screen.dispatchEvent(
        new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }),
      );
    const samples = [];
    for (let run = 0; run < 3; run++) {
      window.mapPerf.map.close();
      window.mapPerf.map.open();
      for (let step = 0; step < 6; step++) {
        const kind = step % 6 < 4 ? "zoom" : step % 6 === 4 ? "pan" : "selection";
        fills = 0;
        fillMs = 0;
        const start = performance.now();
        if (kind === "zoom") {
          screen.dispatchEvent(
            new WheelEvent("wheel", {
              deltaY: step % 4 < 2 ? -55 : 55,
              clientX: 500,
              clientY: 300,
              bubbles: true,
              cancelable: true,
            }),
          );
        } else if (kind === "pan") {
          pointer("pointerdown", 450, 350);
          pointer("pointermove", 475, 365);
          pointer("pointerup", 475, 365);
        } else {
          screen.querySelectorAll(".ada-map-place")[step % 36].click();
        }
        const dispatch = performance.now();
        screen.getBoundingClientRect();
        const dom = performance.now();
        ctx.getImageData(0, 0, 1, 1);
        const raster = performance.now();
        // Serial interactions keep raster completion attributable to each input.
        // eslint-disable-next-line no-await-in-loop
        await new Promise(requestAnimationFrame);
        const raf = performance.now();
        console.log(JSON.stringify({ run, step, kind, totalMs: raster - start }));
        samples.push({
          run,
          step,
          kind,
          dispatchMs: dispatch - start,
          domFlushMs: dom - dispatch,
          rasterFlushMs: raster - dom,
          totalMs: raster - start,
          rafMs: raf - start,
          fills,
          fillMs,
        });
      }
    }
    proto.fill = fill;
    return {
      samples,
      explored: window.mapPerf.state.map.explored.length,
      places: window.mapPerf.state.map.places.length,
      canvas: [canvas.width, canvas.height],
      dpr: devicePixelRatio,
    };
  });
  await page.screenshot({ path: "/tmp/evidence/map.png" });
  writeFileSync("/tmp/evidence/result.json", JSON.stringify({ ...results, errors }, null, 2));
  console.log(JSON.stringify({ samples: results.samples.length, errors }));
} finally {
  await browser.close();
}
