import { pixels } from "./layout/css.ts";
import type { shieldRasterGeometry } from "./layout/shieldGeometry.ts";
import type { ShieldBarView, STATUS_COLOURS } from "./statusPill.ts";

/** One opaque dark rectangle behind both bars; borders are hollow internal outlines. */
export function createShieldDrawing(colours: typeof STATUS_COLOURS) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("ada-shield-drawing");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("preserveAspectRatio", "none");
  const nodes = [
    "pill",
    "shared-background",
    "main-border",
    "fill",
    "delay",
    "flash",
    "edge",
    "timer-border",
    "timer-fill",
  ].map((part) => {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      part.endsWith("border") ? "path" : "rect",
    );
    node.setAttribute("data-part", part);
    svg.append(node);
    return node;
  });
  return {
    node: svg,
    update(g: ReturnType<typeof shieldRasterGeometry>, fraction: number, bar: ShieldBarView) {
      svg.style.left = pixels(g.x);
      svg.style.top = pixels(g.y);
      svg.style.width = pixels(g.width / g.density);
      svg.style.height = pixels(g.height / g.density);
      svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);
      const rect = (
        index: number,
        x: number,
        y: number,
        width: number,
        height: number,
        fill: string,
      ) => {
        for (const [name, value] of Object.entries({
          fill,
          height,
          width: Math.max(0, width),
          x,
          y,
        })) {
          nodes[index]!.setAttribute(name, String(value));
        }
      };
      const outline = (
        index: number,
        box: { x: number; y: number; width: number; height: number },
        edge: number,
        fill: string,
        shown = true,
      ) => {
        const { height, width, x, y } = box;
        const node = nodes[index]!;
        node.setAttribute("fill", fill);
        node.setAttribute("fill-rule", "evenodd");
        const outer = `M${x},${y}h${width}v${height}h${-width}z`;
        const inner = `M${x + edge},${y + edge}h${width - 2 * edge}v${height - 2 * edge}h${2 * edge - width}z`;
        node.setAttribute("d", shown ? `${outer} ${inner}` : "");
      };
      rect(0, 0, 0, g.width, g.height, bar.tone === "normal" ? colours.panel : colours.lowPanel);
      nodes[0]!.setAttribute("rx", String(g.radius));
      const bg = g.background;
      rect(1, bg.x, bg.y, bg.width, bg.height, colours.rechargeEdge);
      outline(2, g.main, g.rim, bar.tone === "normal" ? colours.rim : "var(--shield-mark)");
      const fillWidth = Math.round(g.capacityWidth * fraction);
      rect(
        3,
        g.fill.x,
        g.fill.y,
        fillWidth,
        g.fill.height,
        bar.tone === "low" ? colours.low : colours.shield,
      );
      for (const [node, x, width] of [
        [nodes[3]!, g.fill.x, g.capacityWidth],
        [nodes[8]!, g.timer.x, g.timer.width],
      ] as const) {
        node.setAttribute("data-capacity-start", String(x));
        node.setAttribute("data-capacity-end", String(x + width));
      }
      const overlay = (index: number, range: ShieldBarView["delay"], colour: string) => {
        const from = Math.round(
          (Math.min(bar.fill, range?.from ?? 0) * fillWidth) / (bar.fill || 1),
        );
        const to = Math.round((Math.min(bar.fill, range?.to ?? 0) * fillWidth) / (bar.fill || 1));
        rect(index, g.fill.x + from, g.fill.y, to - from, g.fill.height, colour);
      };
      overlay(4, bar.delay, colours.shieldDelay);
      overlay(5, bar.flash, colours.flash);
      rect(
        6,
        g.fill.x + Math.max(0, fillWidth - g.inset),
        g.fill.y,
        bar.edge ? Math.min(fillWidth, g.inset) : 0,
        g.fill.height,
        colours.flash,
      );
      const timerBox = {
        height: g.timer.height + 2 * g.edge,
        width: g.timer.width + 2 * g.edge,
        x: g.timer.x - g.edge,
        y: g.timer.y - g.edge,
      };
      outline(7, timerBox, g.edge, colours.rechargeEdge, bar.recharge !== null);
      rect(
        8,
        g.timer.x,
        g.timer.y,
        Math.round(g.timer.width * (bar.recharge ?? 0)),
        g.timer.height,
        colours.recharge,
      );
    },
  };
}
