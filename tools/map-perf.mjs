// Dedicated map interaction timings. Run in the isolated Playwright container against a local
// Vite server with HMR/file watching disabled and an empty /__map-perf__.html fixture.
// Measures input dispatch and requestAnimationFrame opportunities without raster readback, not display FPS.
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
  await page.goto(new URL("/__map-perf__.html", origin).href);
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
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  await session.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing,cc",
    transferMode: "ReturnAsStream",
  });
  const metricsBefore = await session.send("Performance.getMetrics");
  const results = await page.evaluate(async () => {
    const screen = window.mapPerf.map.element;
    const proto = CanvasRenderingContext2D.prototype,
      fill = proto.fill;
    let fills = 0,
      styleReads = 0,
      styleMs = 0;
    const originalStyle = window.getComputedStyle;
    proto.fill = function (...args) {
      fills++;
      return fill.apply(this, args);
    };
    window.getComputedStyle = function (...args) {
      styleReads++;
      const t = performance.now();
      const s = originalStyle.apply(this, args);
      styleMs += performance.now() - t;
      return s;
    };
    const pointer = (type, x, y) =>
      screen.dispatchEvent(
        new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }),
      );
    const wheel = (delta) =>
      screen.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: delta,
          clientX: 500,
          clientY: 300,
          bubbles: true,
          cancelable: true,
        }),
      );
    const samples = [];
    for (let run = 0; run < 3; run++) {
      window.mapPerf.map.close();
      window.mapPerf.map.open();
      // Serial frame boundaries preserve input attribution and discard the opening draw.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      window.mapPerf.map.setState(window.mapPerf.state);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      for (const kind of [
        "single-in",
        "single-in",
        "single-out",
        "single-out",
        "burst-in",
        "burst-out",
        "pan-burst",
        "idle-refresh",
        "idle-zoom",
        "selection",
      ]) {
        fills = 0;
        styleReads = 0;
        styleMs = 0;
        let refreshMs = 0;
        const refresh = () => {
          const t = performance.now();
          window.mapPerf.map.setState(structuredClone(window.mapPerf.state));
          refreshMs += performance.now() - t;
        };
        const start = performance.now();
        performance.mark(`map-${run}-${kind}-start`);
        if (kind.startsWith("single")) {
          wheel(kind.endsWith("in") ? -55 : 55);
        } else if (kind.startsWith("burst")) {
          for (let i = 0; i < 8; i++) {
            wheel(kind.endsWith("in") ? -10 : 10);
          }
        } else if (kind === "pan-burst") {
          pointer("pointerdown", 450, 350);
          for (let i = 1; i <= 8; i++) {
            pointer("pointermove", 450 + i * 3, 350 + i * 2);
          }
          pointer("pointerup", 474, 366);
        } else if (kind === "idle-refresh") {
          for (let i = 0; i < 3; i++) {
            refresh();
            // Serial refresh frames reproduce the paused scene's presentation updates.
            // eslint-disable-next-line no-await-in-loop
            await new Promise(requestAnimationFrame);
          }
        } else if (kind === "idle-zoom") {
          for (let i = 0; i < 6; i++) {
            refresh();
          }
          for (let i = 0; i < 8; i++) {
            wheel(-10);
          }
          for (let i = 0; i < 6; i++) {
            refresh();
          }
        } else {
          screen.querySelectorAll(".ada-map-place")[5].click();
        }
        const dispatched = performance.now();
        // eslint-disable-next-line no-await-in-loop
        const first = await new Promise(requestAnimationFrame);
        // eslint-disable-next-line no-await-in-loop
        const second = await new Promise(requestAnimationFrame);
        const end = performance.now();
        performance.mark(`map-${run}-${kind}-end`);
        samples.push({
          run,
          kind,
          dispatchMs: dispatched - start,
          firstRafMs: first - start,
          secondRafMs: second - start,
          completionMs: end - start,
          fills,
          styleReads,
          styleMs,
          refreshMs,
        });
        console.log(JSON.stringify(samples.at(-1)));
      }
    }
    proto.fill = fill;
    window.getComputedStyle = originalStyle;
    return {
      samples,
      positions: [...screen.querySelectorAll(".ada-map-place")].map((x) => ({
        id: x.dataset.place,
        left: x.style.left,
        top: x.style.top,
        selected: x.getAttribute("aria-pressed"),
      })),
      explored: 400,
      places: 36,
      dpr: devicePixelRatio,
    };
  });
  const metricsAfter = await session.send("Performance.getMetrics");
  const traceDone = new Promise((resolve) => {
    session.once("Tracing.tracingComplete", resolve);
  });
  await session.send("Tracing.end");
  const { stream } = await traceDone;
  let trace = "";
  while (true) {
    // CDP stream chunks must be read in order.
    // eslint-disable-next-line no-await-in-loop
    const x = await session.send("IO.read", { handle: stream });
    trace += x.data;
    if (x.eof) {
      break;
    }
  }
  await session.send("IO.close", { handle: stream });
  writeFileSync("/tmp/evidence/trace.json", trace);
  results.metrics = { before: metricsBefore, after: metricsAfter };
  await page.screenshot({ path: "/tmp/evidence/map.png" });
  writeFileSync("/tmp/evidence/result.json", JSON.stringify({ ...results, errors }, null, 2));
  console.log(JSON.stringify({ samples: results.samples.length, errors }));
} finally {
  await browser.close();
}
