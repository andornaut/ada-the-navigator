// PLACEHOLDER (Art): the HUD Stardust count, a plain text plate under the weapon buttons, until
// Art's shield pill beside pause holds the count.
export const STARDUST_COUNTER_STYLE = `
.ada-controls .ada-stardust{
  position:absolute;
  right:max(8px,var(--inset-right));
  top:calc(max(8px,var(--inset-top)) + 56px);
  padding:2px 8px;
  background:#262b44;
  color:#ead4aa;
  border:2px solid #181425;
  font-size:14px;
  line-height:20px;
  pointer-events:none
}
`;

/** PLACEHOLDER (Art): the HUD Stardust count, a plain text plate. */
export function createStardustCounter(parent: HTMLElement) {
  const node = document.createElement("div");
  node.className = "ada-stardust";
  node.setAttribute("role", "status");
  node.hidden = true;
  parent.append(node);
  return {
    dispose: () => node.remove(),
    set(value: string | null): void {
      node.hidden = value === null;
      if (value !== null && node.textContent !== value) {
        node.textContent = value;
      }
    },
  };
}
