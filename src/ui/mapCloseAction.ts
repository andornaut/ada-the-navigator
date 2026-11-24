import { mapCloseStyle, standardCloseActionStyle } from "./modalClose.ts";

/** The Map styles paint the sprite on the button's pseudo-elements. */
export function mapCloseActionStyle(selector: string, restFace?: string): string {
  return `
${mapCloseStyle(selector, restFace)}
${standardCloseActionStyle(selector)}
`;
}
