/** The shared close artwork on a native button. The modal owns its action binding. */
export function createModalClose(action: string, label: string): HTMLButtonElement {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  close.dataset.action = action;
  close.setAttribute("aria-label", label);
  return close;
}
