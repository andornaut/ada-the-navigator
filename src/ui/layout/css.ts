import { CONTROL_EDGE, noticeReserve, type Side } from "./playView.ts";

// CSS for logical sizes. The view-scale bridge (viewScale.ts) sets these custom properties on the
// play area (#app: the canvas, the controls overlay, notices and the story panel); every DOM UI
// size is a logical value through these helpers, never raw CSS px.
export const VIEW_HOST_ID = "app";

// The HUD rect's edges the top controls anchor to.
export type HudSide = "left" | "right" | "top";
export const HUD_SIDES: readonly HudSide[] = ["top", "right", "left"];

export const VIEW_PROPERTIES = {
  // The HUD rect's top, left and right edges in from the view's (playView.ts hudRect).
  hud: (side: HudSide) => `--ada-hud-${side}`,
  // How far a centred notice keeps in from the HUD rect's sides (playView.ts noticeReserve).
  noticeReserve: "--ada-notice-reserve",
  safe: (side: Side) => `--ada-safe-${side}`,
  slice: (edge: number) => `--ada-slice-${edge}`,
  unit: "--ada-unit",
} as const;

const scaled = (value: number) => `var(${VIEW_PROPERTIES.unit}) * ${value}px`;

// A logical length: calc(var(--ada-unit) * N).
export function units(value: number): string {
  // Zero stays a length, so it is valid inside max() and calc().
  return value === 0 ? "0px" : `calc(${scaled(value)})`;
}

// A safe rect's edge on side, for margin m: the view edge moved in by max(m, inset).
export function safeEdge(side: Side, margin: number): string {
  return `max(var(${VIEW_PROPERTIES.safe(side)}), ${units(margin)})`;
}

// A logical offset in from a safe rect's edge.
export function fromSafeEdge(side: Side, margin: number, offset: number): string {
  return offset === 0
    ? safeEdge(side, margin)
    : `calc(${safeEdge(side, margin)} + ${scaled(offset)})`;
}

// A logical offset in from the HUD rect's edge on side (playView.ts hudRect); negative reaches
// past it.
export function fromHudEdge(side: HudSide, offset = 0): string {
  const edge = `var(${VIEW_PROPERTIES.hud(side)})`;
  return offset === 0 ? edge : `calc(${edge} + ${scaled(offset)})`;
}

// A type role (tokens.ts TYPE) as the CSS font shorthand, in the UI face.
export function font(role: {
  readonly lineHeight: number;
  readonly size: number;
  readonly weight: number;
}): string {
  return `${role.weight} ${units(role.size)}/${units(role.lineHeight)} AdaUI,'Liberation Sans',sans-serif`;
}

// A nine-slice edge as whole CSS px: round(edge * s).
export function slice(edge: number): string {
  return `var(${VIEW_PROPERTIES.slice(edge)})`;
}

// The play area's defaults until the bridge first measures, and the hidden probe that resolves
// the frame's safe-area insets (game-kit's frame-turn --inset-* properties) to CSS px.
export function viewStyle(edges: readonly number[]): string {
  return `
#${VIEW_HOST_ID}{
  ${VIEW_PROPERTIES.unit}:1;
  ${VIEW_PROPERTIES.noticeReserve}:${units(noticeReserve(0))};
  ${HUD_SIDES.map((side) => `${VIEW_PROPERTIES.hud(side)}:${units(CONTROL_EDGE)};`).join("\n  ")}
  ${(["top", "right", "bottom", "left"] as const).map((side) => `${VIEW_PROPERTIES.safe(side)}:0px;`).join("\n  ")}
  ${edges.map((edge) => `${VIEW_PROPERTIES.slice(edge)}:${edge}px;`).join("\n  ")}
}

.ada-safe-probe{
  position:absolute;
  top:0;
  left:0;
  width:0;
  height:0;
  visibility:hidden;
  pointer-events:none;
  padding:var(--inset-top,0px) var(--inset-right,0px) var(--inset-bottom,0px) var(--inset-left,0px)
}
`;
}
