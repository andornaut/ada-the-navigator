const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const PLACEMENT_ATTRIBUTES = ["id", "x", "y"];

/** Remove only plain placement attributes from XMLSerializer's opening tag. */
function stripPlacement(xml: string): string | undefined {
  if (!xml.startsWith("<svg")) {
    return undefined;
  }
  // A sticky token accounts for each root attribute, including quoted delimiters in its value.
  const attribute = / ([A-Za-z_][A-Za-z0-9_.-]*)="[^"<]*"/y;
  let cursor = 4;
  let kept = 0;
  let result = "";
  while (xml[cursor] === " ") {
    attribute.lastIndex = cursor;
    const token = attribute.exec(xml);
    if (!token) {
      return undefined;
    }
    if (PLACEMENT_ATTRIBUTES.includes(token[1]!)) {
      result += xml.slice(kept, cursor);
      kept = attribute.lastIndex;
    }
    cursor = attribute.lastIndex;
  }
  return xml[cursor] === ">" || xml.startsWith("/>", cursor) ? result + xml.slice(kept) : undefined;
}

function standaloneSvg(frame: Element): string {
  const serializer = new XMLSerializer();
  if (
    frame.prefix === null &&
    Array.from(frame.attributes).every(
      (attr) =>
        (attr.namespaceURI === null && attr.name !== "xmlns") ||
        (attr.namespaceURI === XMLNS_NAMESPACE &&
          attr.name === "xmlns" &&
          attr.value === SVG_NAMESPACE),
    )
  ) {
    // Namespace-qualified roots and attributes use the original clone path.
    const stripped = stripPlacement(serializer.serializeToString(frame));
    if (stripped !== undefined) {
      return stripped;
    }
  }
  const standalone = frame.cloneNode(true) as Element;
  for (const attribute of PLACEMENT_ATTRIBUTES) {
    standalone.removeAttribute(attribute);
  }
  return serializer.serializeToString(standalone);
}

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
    svgSheetMember,
    width,
  }: {
    readonly height: number;
    readonly id: string;
    readonly intrinsicHeight?: number;
    readonly intrinsicWidth?: number;
    readonly svgSheetMember?: string;
    readonly width: number;
  },
  viewBoxOrigin: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
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
  const expectedWidth = intrinsicWidth ?? width;
  const expectedHeight = intrinsicHeight ?? height;
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
    !Number.isFinite(viewBoxOrigin.x) ||
    !Number.isFinite(viewBoxOrigin.y) ||
    viewBox[0] !== viewBoxOrigin.x ||
    viewBox[1] !== viewBoxOrigin.y ||
    viewBox[2] !== width ||
    viewBox[3] !== height ||
    !sized
  ) {
    throw new Error(`Invalid frame ${id} in vector sheet: ${path}`);
  }
  const encoded = btoa(standaloneSvg(frame));
  return `data:image/svg+xml;base64,${encoded}`;
}
