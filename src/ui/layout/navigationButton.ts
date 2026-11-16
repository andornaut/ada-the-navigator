import rest from "../../../public/art/ui/icons/pause.svg?raw";
import held from "../../../public/art/ui/icons/pause-held.svg?raw";
import press from "../../../public/art/ui/icons/pause-press.svg?raw";
import { MODAL_LAYER, UI_SCOPE } from "../modal.ts";

/** Keep the actual Pause pose chrome and glyph ink, replacing only its two bars. */
export function menuPoseSvg(pause: string): string {
  return pause.replace(
    /<path fill="([^"]+)" d="[^"]+"\s*\/>/u,
    (_path, fill: string) =>
      `<g fill="${fill}">${[11, 16, 21]
        .map((y) => `<rect x="12" y="${y}" width="11" height="3" />`)
        .join("")}</g>`,
  );
}

const menu = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(menuPoseSvg(svg))}")`;

export const NAVIGATION_BUTTON_STYLE = `
${UI_SCOPE} .ada-pause[data-navigation=menu]{
  z-index:${MODAL_LAYER + 1}
}
${UI_SCOPE}.ada-modal-open .ada-pause[inert]{
  z-index:${MODAL_LAYER - 1}
}
${UI_SCOPE} .ada-pause[data-navigation=menu]::before{
  background-image:${menu(rest)}
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=press]::before{
  background-image:${menu(press)}
}
${UI_SCOPE} .ada-pause[data-navigation=menu][data-pose=held]::before{
  background-image:${menu(held)}
}
`;
