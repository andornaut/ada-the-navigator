const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function vectorSheetKey(path: string): string {
  return `vector-sheet:${path}`;
}

/** Extract one independent SVG root at its original intrinsic size. */
export function vectorSheetSource(
  xml: Document | undefined,
  path: string,
  {
    height,
    id,
    intrinsicHeight,
    intrinsicWidth,
    width,
  }: {
    readonly height: number;
    readonly id: string;
    readonly intrinsicHeight?: number;
    readonly intrinsicWidth?: number;
    readonly width: number;
  },
): string {
  const root = xml?.documentElement;
  if (root?.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error(`Invalid vector sheet: ${path}`);
  }
  const matches = Array.from(root.children).filter((child) => child.id === id);
  const frame = matches[0];
  const viewBox = frame
    ?.getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/u)
    .map(Number);
  if (
    matches.length !== 1 ||
    frame?.localName !== "svg" ||
    frame.namespaceURI !== SVG_NAMESPACE ||
    viewBox?.length !== 4 ||
    viewBox[0] !== 0 ||
    viewBox[1] !== 0 ||
    viewBox[2] !== width ||
    viewBox[3] !== height ||
    Number(frame.getAttribute("width")) !== (intrinsicWidth ?? width) ||
    Number(frame.getAttribute("height")) !== (intrinsicHeight ?? height)
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
