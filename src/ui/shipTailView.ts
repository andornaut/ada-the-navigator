const SVG = "http://www.w3.org/2000/svg";
let nextTail = 0;

/** A foreground copy of the painted hull, restricted to its authored tail surfaces. */
export function createShipTailView(size: number) {
  const root = document.createElementNS(SVG, "svg");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("viewBox", `0 0 ${size} ${size}`);
  const defs = document.createElementNS(SVG, "defs");
  const clip = document.createElementNS(SVG, "clipPath");
  const id = `ada-tail-${nextTail++}`;
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  defs.append(clip);
  const image = document.createElementNS(SVG, "image");
  image.setAttribute("width", String(size));
  image.setAttribute("height", String(size));
  image.setAttribute("clip-path", `url(#${id})`);
  root.append(defs, image);
  let previous = "";
  return {
    root,
    set(source: string, regions: readonly string[]): void {
      root.style.display = regions.length && source ? "" : "none";
      const key = JSON.stringify([source, regions]);
      if (key === previous) {
        return;
      }
      previous = key;
      image.setAttribute("href", source);
      clip.replaceChildren(
        ...[...new Set(regions)].map((points) => {
          const polygon = document.createElementNS(SVG, "polygon");
          polygon.setAttribute("points", points);
          return polygon;
        }),
      );
    },
  };
}
