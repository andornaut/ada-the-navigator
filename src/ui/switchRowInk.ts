import { frameBoxIn, frameGridOrigin, readViewUnit } from "./layout/dom.ts";
import { lineInkTop, pixels, UI_FONT_FACE } from "./layout/index.ts";

/** The canvas text measure switch rows read their label ink from, or undefined without canvas. */
export function createInkMeasure(): CanvasRenderingContext2D | null | undefined {
  return document.createElement("canvas").getContext?.("2d");
}

/**
 * Aligns each shown switch row's icon ink top with its label's ink top, as in Settings: from the
 * label's line box wherever the row places it (top or centred) and the loaded font's metrics,
 * snapped to the device pixel row. Call it after the rows have their final layout.
 */
export function alignSwitchRowIcons(
  measure: CanvasRenderingContext2D | null | undefined,
  rows: Iterable<HTMLElement>,
): void {
  if (!measure) {
    return;
  }
  for (const row of rows) {
    const caption = row.querySelector<HTMLElement>(".ada-setting-text")?.firstElementChild;
    if (!caption || row.getClientRects().length === 0) {
      continue;
    }
    const unit = readViewUnit(row);
    const style = getComputedStyle(caption);
    measure.font = style.font;
    const ink = measure.measureText(caption.textContent ?? "");
    const size = parseFloat(style.fontSize) / unit;
    // The row's top along the frame's vertical axis, on the CSS px grid whose device pixel edges
    // lie where (top + v) * ratio is whole.
    const top = frameGridOrigin(row).y;
    // The label's line box top in the row's frame axes, wherever the row places it, then its ink
    // inside that line.
    const captionTop = frameBoxIn(row, caption).y / unit;
    const inkTop =
      captionTop +
      lineInkTop({
        ascent: UI_FONT_FACE.ascent * size,
        descent: UI_FONT_FACE.descent * size,
        inkAscent: ink.actualBoundingBoxAscent / unit,
        lineHeight: parseFloat(style.lineHeight) / unit,
      });
    const ratio = window.devicePixelRatio || 1;
    // Align the visible sprite to the title's device-pixel ink row after the card has fitted.
    const snapped = Math.floor((top + inkTop * unit) * ratio) / ratio;
    row.style.setProperty("--setting-title-ink-top", pixels(snapped - top));
  }
}
