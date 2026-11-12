import { CAST, CAST_FRAMES, castSheet } from "../data/cast.ts";
import { KEEPERS } from "../data/keepers.ts";
import type { StationGreeting } from "../model/keepers.ts";
import { CONVERSATION_BOX } from "./layout/conversationBox.ts";
import { font, units } from "./layout/css.ts";
import { KEEPER_BLOCK } from "./layout/stationCard.ts";
import { FOCUS_STYLE, TEXT_TOKENS } from "./modal.ts";
import { PANEL_BACKGROUND } from "./notice.ts";

// The station card's keeper block (art/layout.md "Station card"): the conversation box's panel in
// the card, with the keeper's compact portrait on the right, the name tab over its top-left and
// the docking's line. While a first docking has lines to come, the panel and its tab are one
// button that shows the next line and three static pips mark the lines; on the last line, and on
// a later docking, the block is a status. Black Eye's stations show the generic welcome centred,
// with no portrait or tab.

const { name: label, padding, panel, portrait, tab, text } = CONVERSATION_BOX;
const { pips } = KEEPER_BLOCK;

// Each keeper's portrait sheet and tab fill; data-keeper names the keeper on the block.
const KEEPER_RULES = Object.values(KEEPERS)
  .flatMap(({ keepers }) => keepers)
  .map(
    (key) => `
.ada-controls .ada-keeper[data-keeper="${key}"] .ada-keeper-portrait{
  background:url('${castSheet(key, true)}') 0 0 / ${units(
    CAST_FRAMES.frames * portrait.art,
  )} ${units(portrait.art)} no-repeat
}
.ada-controls .ada-keeper[data-keeper="${key}"] .ada-keeper-name{
  background:${CAST[key].tab}
}`,
  )
  .join("");

export const KEEPER_STYLE = `
/* The panel: the conversation box's, in the card's flow below the name tab's overhang. The card
   never scrolls, so its body lets the focus ring show past the block's sides. */
.ada-controls [data-dialog="station"] .ada-card-body{
  overflow:visible
}
.ada-controls .ada-keeper{
  position:relative;
  flex:none;
  box-sizing:border-box;
  width:${units(KEEPER_BLOCK.width)};
  height:${units(KEEPER_BLOCK.height)};
  min-height:0;
  min-width:0;
  margin:${units(tab.overhang)} 0 0;
  padding:0;
  border:0;
  border-radius:0;
  background:${PANEL_BACKGROUND};
  font:${font(text)};
  color:${TEXT_TOKENS.label};
  text-align:left
}
.ada-controls button.ada-keeper{
  cursor:pointer;
  touch-action:manipulation
}
.ada-controls button.ada-keeper:hover{
  background:${PANEL_BACKGROUND}
}
.ada-controls .ada-keeper:focus-visible{${FOCUS_STYLE}
}

.ada-controls .ada-keeper-frame{
  position:absolute;
  top:${units(padding)};
  right:${units(padding)};
  box-sizing:border-box;
  width:${units(portrait.frame)};
  height:${units(portrait.frame)};
  display:flex;
  align-items:center;
  justify-content:center;
  border:${units(portrait.edge)} solid ${panel.ink};
  background:${portrait.face}
}
.ada-controls .ada-keeper-portrait{
  width:${units(portrait.art)};
  height:${units(portrait.art)};
  image-rendering:pixelated
}

/* The text column beside the frame: its lines centred on the panel, the pips after the last. */
.ada-controls .ada-keeper-body{
  position:absolute;
  top:${units(KEEPER_BLOCK.text.y)};
  left:${units(KEEPER_BLOCK.text.x)};
  width:${units(KEEPER_BLOCK.text.width)};
  height:${units(KEEPER_BLOCK.text.height)};
  display:flex;
  align-items:center
}
.ada-controls .ada-keeper-lines{
  display:flex;
  align-items:flex-end;
  gap:${units(pips.offset)}
}
.ada-controls .ada-keeper-line{
  width:${units(KEEPER_BLOCK.text.width)};
  overflow-wrap:break-word;
  overflow:hidden;
  max-height:${units(CONVERSATION_BOX.lines * text.lineHeight)}
}
.ada-controls .ada-keeper[data-pips] .ada-keeper-line{
  width:${units(KEEPER_BLOCK.textWithPips)}
}
.ada-controls .ada-keeper-pips{
  flex:none;
  height:${units(text.lineHeight)};
  display:flex;
  align-items:center;
  gap:${units(pips.gap)}
}
.ada-controls .ada-keeper:not([data-pips]) .ada-keeper-pips{
  display:none
}
.ada-controls .ada-keeper-pip{
  box-sizing:border-box;
  width:${units(pips.disc)};
  height:${units(pips.disc)};
  border:${units(pips.ring)} solid ${TEXT_TOKENS.supporting};
  border-radius:50%
}
.ada-controls .ada-keeper-pip[data-shown]{
  border-color:${TEXT_TOKENS.label};
  background:${TEXT_TOKENS.label}
}

.ada-controls .ada-keeper-name{
  position:absolute;
  top:${units(-tab.overhang)};
  left:${units(tab.inset)};
  box-sizing:border-box;
  height:${units(tab.height)};
  padding:0 ${units(tab.labelInset - tab.edge)};
  border:${units(tab.edge)} solid ${panel.ink};
  border-radius:${units(tab.radius)};
  font:${font(label)};
  line-height:${units(tab.height - 2 * tab.edge)};
  white-space:nowrap;
  color:${panel.ink}
}

/* Black Eye: the generic welcome alone, centred a gap inside each side. */
.ada-controls .ada-keeper[data-generic] .ada-keeper-frame,
.ada-controls .ada-keeper[data-generic] .ada-keeper-name{
  display:none
}
.ada-controls .ada-keeper[data-generic] .ada-keeper-body{
  left:${units(KEEPER_BLOCK.genericInset)};
  width:${units(KEEPER_BLOCK.width - 2 * KEEPER_BLOCK.genericInset)};
  justify-content:center;
  text-align:center
}
.ada-controls .ada-keeper[data-generic] .ada-keeper-line{
  width:auto
}
${KEEPER_RULES}
`;

export interface KeeperBlock {
  /** The block as it is now in the card: a button while lines are to come, a status otherwise. */
  readonly element: () => HTMLElement;
  /** Shows greeting, or the generic welcome for null. */
  render(greeting: StationGreeting | null): void;
}

/**
 * The block, which shows each greeting rendered into it. A press on the button calls advance; when
 * the last line shows the button gives way to the status in place, and focus moves to
 * focusAfter if the button had it.
 */
export function createKeeperBlock(options: {
  readonly advance: () => void;
  readonly focusAfter: () => HTMLElement;
  readonly labels: { readonly nextLine: string; readonly welcome: string };
}): KeeperBlock {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", options.labels.nextLine);
  const status = document.createElement("div");
  for (const host of [button, status]) {
    host.className = "ada-keeper";
  }
  const frame = document.createElement("span");
  frame.className = "ada-keeper-frame";
  frame.setAttribute("aria-hidden", "true");
  const face = document.createElement("span");
  face.className = "ada-keeper-portrait";
  frame.append(face);
  const body = document.createElement("span");
  body.className = "ada-keeper-body";
  const lines = document.createElement("span");
  lines.className = "ada-keeper-lines";
  const line = document.createElement("span");
  line.className = "ada-keeper-line";
  line.id = "ada-keeper-line";
  line.setAttribute("aria-live", "polite");
  const dots = document.createElement("span");
  dots.className = "ada-keeper-pips";
  dots.setAttribute("aria-hidden", "true");
  const discs = Array.from({ length: pips.count }, () => {
    const disc = document.createElement("span");
    disc.className = "ada-keeper-pip";
    return disc;
  });
  dots.append(...discs);
  lines.append(line, dots);
  body.append(lines);
  const name = document.createElement("span");
  name.className = "ada-keeper-name";
  button.setAttribute("aria-describedby", line.id);
  button.addEventListener("click", options.advance);
  let current: HTMLElement = status;
  status.append(frame, body, name);
  return {
    element: () => current,
    render(greeting) {
      const advancing = greeting !== null && greeting.index < greeting.count - 1;
      const next = advancing ? button : status;
      if (next !== current) {
        const focused = document.activeElement === current;
        next.append(frame, body, name);
        current.replaceWith(next);
        current = next;
        if (focused && !advancing) {
          options.focusAfter().focus();
        }
      }
      line.textContent = greeting?.line ?? options.labels.welcome;
      if (greeting) {
        next.dataset.keeper = greeting.keeper;
        name.textContent = CAST[greeting.keeper].name;
        next.removeAttribute("data-generic");
      } else {
        delete next.dataset.keeper;
        name.textContent = "";
        next.setAttribute("data-generic", "");
      }
      const counted = greeting !== null && greeting.count > 1;
      next.toggleAttribute("data-pips", counted);
      discs.forEach((disc, index) => {
        disc.toggleAttribute("data-shown", counted && index <= greeting.index);
      });
    },
  };
}
