/** The production prose element shared by cards and typed layout ports. */
export function createProse(text = ""): HTMLParagraphElement {
  const prose = document.createElement("p");
  prose.className = "ada-prose";
  prose.textContent = text;
  return prose;
}
