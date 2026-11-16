const UNDERLAY = "data-ada-modal-underlay";

/** Retains the original parent paint while its semantic view is closed behind a child. */
export function retainModalUnderlay(modal: HTMLElement): () => void {
  const inert = modal.getAttribute("inert") !== null;
  const ariaHidden = modal.getAttribute("aria-hidden");
  modal.setAttribute(UNDERLAY, "");
  modal.setAttribute("inert", "");
  modal.setAttribute("aria-hidden", "true");
  let retained = true;
  return () => {
    if (!retained) {
      return;
    }
    retained = false;
    modal.removeAttribute(UNDERLAY);
    if (!inert) {
      modal.removeAttribute("inert");
    }
    if (ariaHidden === null) {
      modal.removeAttribute("aria-hidden");
    } else {
      modal.setAttribute("aria-hidden", ariaHidden);
    }
  };
}
