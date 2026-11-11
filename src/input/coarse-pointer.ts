// Whether the page's primary pointer is coarse (a touch screen): one query list per window, whose
// matches follows the device, as in Chibi.
const coarseQueries = new WeakMap<object, MediaQueryList>();

export function coarsePointer(host: Pick<Window, "matchMedia">): boolean {
  let query = coarseQueries.get(host);
  if (!query) {
    query = host.matchMedia("(pointer: coarse)");
    coarseQueries.set(host, query);
  }
  return query.matches;
}

// The on-screen joysticks and their pointer targets exist only on a touch screen, while controls
// are enabled and no modal is open. Keyboard play does not depend on them.
export function touchControlsActive(
  host: Pick<Window, "matchMedia">,
  enabled: boolean,
  modalOpen: boolean,
): boolean {
  return enabled && !modalOpen && coarsePointer(host);
}
