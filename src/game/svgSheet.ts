const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function vectorSheetKey(path: string): string {
  return `vector-sheet:${path}`;
}

/** Extract one independent SVG root at its original intrinsic size. */
export function vectorSheetSource(
  xml: Document | undefined,
  path: string,
  {
    archetype,
    displayHeight,
    displayWidth,
    height,
    id,
    intrinsicHeight,
    intrinsicWidth,
    svgSheetMember,
    width,
  }: {
    readonly archetype?: string;
    readonly displayHeight?: number;
    readonly displayWidth?: number;
    readonly height: number;
    readonly id: string;
    readonly intrinsicHeight?: number;
    readonly intrinsicWidth?: number;
    readonly svgSheetMember?: string;
    readonly width: number;
  },
): string {
  const root = xml?.documentElement;
  if (root?.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error(`Invalid vector sheet: ${path}`);
  }
  const member = svgSheetMember === undefined ? id : svgSheetMember;
  if (typeof member !== "string" || member.length === 0) {
    throw new Error(`Invalid frame ${id} in vector sheet: ${path}`);
  }
  const matches = Array.from(root.children).filter((child) => child.id === member);
  const frame = matches[0];
  const viewBox = frame
    ?.getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/u)
    .map(Number);
  // Station hull roots retain their authored display size within the raw frame viewBox.
  const station = archetype === "hostileStation";
  const expectedWidth = intrinsicWidth ?? (station ? displayWidth : undefined) ?? width;
  const expectedHeight = intrinsicHeight ?? (station ? displayHeight : undefined) ?? height;
  // A display-sized root may instead be authored at its raw frame size, as the enemy fleet
  // producer writes every hull and part root.
  const rootWidth = Number(frame?.getAttribute("width"));
  const rootHeight = Number(frame?.getAttribute("height"));
  const sized =
    (rootWidth === expectedWidth && rootHeight === expectedHeight) ||
    (intrinsicWidth !== undefined && rootWidth === width && rootHeight === height);
  if (
    matches.length !== 1 ||
    frame?.localName !== "svg" ||
    frame.namespaceURI !== SVG_NAMESPACE ||
    viewBox?.length !== 4 ||
    viewBox[0] !== 0 ||
    viewBox[1] !== 0 ||
    viewBox[2] !== width ||
    viewBox[3] !== height ||
    !sized
  ) {
    throw new Error(`Invalid frame ${id} in vector sheet: ${path}`);
  }
  const standalone = frame.cloneNode(true) as Element;
  for (const attribute of ["id", "x", "y"]) {
    standalone.removeAttribute(attribute);
  }
  const encoded = btoa(new XMLSerializer().serializeToString(standalone));
  return `data:image/svg+xml;base64,${encoded}`;
}
