// The Android back gesture or button, or the browser's Back. The page stays on the game, so the
// game decides what back means (close a card or pause).
export const PHONE_BACK_PRESSED = "back-pressed";

export function dispatchPhoneBack(target: EventTarget): void {
  target.dispatchEvent(new Event(PHONE_BACK_PRESSED));
}
