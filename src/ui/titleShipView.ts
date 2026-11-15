import { fromAreaLeft, units } from "./layout/css.ts";
import { START_SCREEN } from "./layout/startScreen.ts";
import { createShipTailView } from "./shipTailView.ts";
import { jetPolygons, type TitleScreenArt, titleShip } from "./titleScreen.ts";

const { ship } = START_SCREEN;
const SVG = "http://www.w3.org/2000/svg";
let nextJetMask = 0;

export const TITLE_SHIP_STYLE = `
.ada-story-ship .ada-start-jets,
.ada-story-ship .ada-start-ship,
.ada-start .ada-start-jets,
.ada-start .ada-start-ship{
  position:absolute;
  left:${fromAreaLeft(ship.centre.x - ship.size / 2)};
  top:${units(ship.centre.y - ship.size / 2)};
  width:${units(ship.size)};
  height:${units(ship.size)};
  overflow:visible;
  image-rendering:pixelated
}
`;

/** The homepage ship and normal jets, including their original ordered occlusion masks. */
export function titleShipView(art: TitleScreenArt, paint: string | null): readonly Element[] {
  const jetSvg = () => {
    const node = document.createElementNS(SVG, "svg");
    node.classList.add("ada-start-jets");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("viewBox", `0 0 ${ship.size} ${ship.size}`);
    return node;
  };
  const jets = jetSvg();
  const polygons = jetPolygons(art);
  const front =
    art.normalJets || polygons.some(({ occluders }) => occluders !== undefined) ? jetSvg() : null;
  front?.classList.add("ada-start-jets-front");
  const masks = new Map<string, string>();
  // Include every plume's extent so a mask never clips exhaust outside the sprite frame.
  const coordinates = polygons.flatMap(({ points }) =>
    points.split(" ").map((point) => point.split(",").map(Number)),
  );
  const xs = coordinates.map(([x]) => x!);
  const ys = coordinates.map(([, y]) => y!);
  for (const { fill, occluders, opacity, points } of polygons) {
    const polygon = document.createElementNS(SVG, "polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("fill", fill);
    polygon.setAttribute("fill-opacity", String(opacity));
    if (art.normalJets && front) {
      front.append(polygon);
    } else if (occluders !== undefined && front) {
      const signature = JSON.stringify(occluders);
      let id = masks.get(signature);
      if (!id) {
        id = `ada-title-jet-mask-${nextJetMask++}`;
        masks.set(signature, id);
        const mask = document.createElementNS(SVG, "mask");
        mask.setAttribute("id", id);
        mask.setAttribute("maskUnits", "userSpaceOnUse");
        mask.setAttribute("maskContentUnits", "userSpaceOnUse");
        const rect = document.createElementNS(SVG, "rect");
        for (const [name, value] of Object.entries({
          height: Math.max(...ys) - Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          x: Math.min(...xs),
          y: Math.min(...ys),
        })) {
          mask.setAttribute(name, String(value));
          rect.setAttribute(name, String(value));
        }
        rect.setAttribute("fill", "white");
        mask.append(rect);
        for (const points of occluders) {
          const cover = document.createElementNS(SVG, "polygon");
          cover.setAttribute("points", points);
          cover.setAttribute("fill", "black");
          mask.append(cover);
        }
        const defs = document.createElementNS(SVG, "defs");
        defs.append(mask);
        front.append(defs);
      }
      polygon.setAttribute("mask", `url(#${id})`);
      front.append(polygon);
    } else {
      jets.append(polygon);
    }
  }
  const frame = document.createElement("img");
  frame.className = "ada-start-ship";
  frame.alt = "";
  frame.setAttribute("aria-hidden", "true");
  frame.src = titleShip(art, paint);
  const parts: Element[] = [jets, frame];
  if (front) {
    parts.push(front);
  }
  if (art.normalJets) {
    const tail = createShipTailView(ship.size);
    tail.root.classList.add("ada-start-jets", "ada-start-tail");
    tail.set(
      frame.src,
      polygons.flatMap(({ occluders }) => occluders ?? []),
    );
    parts.push(tail.root);
  }
  return parts;
}
