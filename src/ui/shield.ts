export function createShieldMeter(label: string, parent: HTMLElement) {
  const root = document.createElement("div");
  root.className = "ada-shield-meter";
  root.setAttribute("role", "meter");
  root.setAttribute("aria-label", label);
  root.setAttribute("aria-valuemin", "0");
  root.hidden = true;
  const fill = document.createElement("span");
  fill.setAttribute("aria-hidden", "true");
  root.append(fill);
  parent.append(root);
  return {
    dispose: () => root.remove(),
    setEnabled(enabled: boolean): void {
      root.hidden = !enabled;
    },
    setShield(maximum: number, shield: number): void {
      const max = Number.isFinite(maximum) && maximum > 0 ? maximum : 1;
      const value = Number.isFinite(shield) ? Math.max(0, Math.min(max, shield)) : 0;
      root.setAttribute("aria-valuemax", String(max));
      root.setAttribute("aria-valuenow", String(value));
      fill.style.transform = `scaleX(${value / max})`;
    },
  };
}
