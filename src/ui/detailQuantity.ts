/** A full current quantity, without the HUD's compact abbreviation. */
export function detailCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function renderDetailQuantity(
  row: HTMLElement,
  icon: HTMLElement | undefined,
  value: string | undefined,
  label?: string,
): void {
  row.className = "ada-detail-quantity";
  row.hidden = value === undefined;
  row.replaceChildren();
  row.removeAttribute("aria-label");
  if (value === undefined) {
    return;
  }
  if (icon) {
    icon.setAttribute("aria-hidden", "true");
    row.append(icon);
  }
  const text = document.createElement("span");
  text.textContent = value;
  row.append(text);
  if (label) {
    row.setAttribute("aria-label", `${label}: ${value}`);
  }
}
