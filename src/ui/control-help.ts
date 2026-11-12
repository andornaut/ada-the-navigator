import { INLINE_CONTROL } from "./layout/controls.ts";
import { units } from "./layout/css.ts";

// Text with inline control icons (gameplay/rules.md, art/settings-icons.md "Inline controls"):
// each {move}, {aim} or {use} token in player copy becomes the control's name, then Art's 16 by 16
// icon of the control. The name stays for screen readers; the icon is decorative. The game expands
// tokens in the page; the landing page's build expands the same tokens into markup.

export type HelpControl = "aim" | "move" | "use";
export const HELP_CONTROLS: readonly HelpControl[] = ["move", "aim", "use"];

/** Each control's name, written before its icon. */
export type ControlWords = Readonly<Record<HelpControl, string>>;

/** Each control's icon sheet in the UI manifest. */
export const CONTROL_ICONS: Readonly<Record<HelpControl, string>> = {
  aim: "icon-aim-controls",
  move: "icon-move-controls",
  use: "icon-use-control",
};

/** A control's icon image: the sheet's PNG is its one 16 by 16 frame. */
export const controlIconSource = (control: HelpControl): string =>
  `/art/ui/sprites/${CONTROL_ICONS[control]}.png`;

/**
 * The name and its icon wrap as one; the icon starts a gap after the name, centred on the line
 * box, nearest-neighbour at every density.
 */
export const CONTROL_HELP_STYLE = `
.ada-control-help{
  white-space:nowrap
}
.ada-control-icon{
  display:inline-block;
  width:${units(INLINE_CONTROL.icon)};
  height:${units(INLINE_CONTROL.icon)};
  margin:${units(INLINE_CONTROL.inset)} 0 ${units(INLINE_CONTROL.inset)} ${units(INLINE_CONTROL.gap)};
  vertical-align:top;
  image-rendering:pixelated
}
`;

export type ControlHelpPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly control: HelpControl; readonly kind: "control" };

const isControl = (token: string): token is HelpControl =>
  (HELP_CONTROLS as readonly string[]).includes(token);

/** Text's runs and control tokens, in order; an unknown token throws. */
export function controlHelpParts(text: string): readonly ControlHelpPart[] {
  const parts: ControlHelpPart[] = [];
  let start = 0;
  for (const match of text.matchAll(/\{([^{}]+)\}/gu)) {
    if (match.index > start) {
      parts.push({ kind: "text", text: text.slice(start, match.index) });
    }
    const control = match[1]!;
    if (!isControl(control)) {
      throw new Error(`Unknown control help token ${control}`);
    }
    parts.push({ control, kind: "control" });
    start = match.index + match[0].length;
  }
  if (start < text.length) {
    parts.push({ kind: "text", text: text.slice(start) });
  }
  return parts;
}

/** Text with each token as its control's name alone: keyboard wording and plain text. */
export function controlHelpText(words: ControlWords, text: string): string {
  return controlHelpParts(text)
    .map((part) => (part.kind === "text" ? part.text : words[part.control]))
    .join("");
}

/** Text's runs and controls as nodes: text, and each control's name then its icon. */
export function createControlHelp(document: Document, words: ControlWords, text: string): Node[] {
  return controlHelpParts(text).map((part) => {
    if (part.kind === "text") {
      return document.createTextNode(part.text);
    }
    const icon = document.createElement("img");
    icon.className = "ada-control-icon";
    icon.dataset.control = part.control;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.src = controlIconSource(part.control);
    const unit = document.createElement("span");
    unit.className = "ada-control-help";
    unit.append(document.createTextNode(words[part.control]), icon);
    return unit;
  });
}

/** Value escaped for HTML text and double-quoted attributes. */
export const escaped = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Text with each token as its name then its icon, as escaped HTML for a static page. */
export function controlHelpMarkup(words: ControlWords, text: string): string {
  return controlHelpParts(text)
    .map((part) =>
      part.kind === "text"
        ? escaped(part.text)
        : `<span class="ada-control-help">${escaped(words[part.control])}` +
          `<img class="ada-control-icon" data-control="${part.control}" ` +
          `src="${controlIconSource(part.control)}" alt="" aria-hidden="true" ` +
          `width="${INLINE_CONTROL.icon}" height="${INLINE_CONTROL.icon}"></span>`,
    )
    .join("");
}
