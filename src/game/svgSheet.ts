const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function vectorSheetKey(path: string): string {
  return `vector-sheet:${path}`;
}

/** Extract one independent SVG root at its original intrinsic size. */
export function vectorSheetSource(
  xml: Document | undefined,
  path: string,
  { height, id, width }: { readonly id: string; readonly width: number; readonly height: number },
): string {
  const root = xml?.documentElement;
  if (root?.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error(`Invalid vector sheet: ${path}`);
  }
  const matches = Array.from(root.children).filter((child) => child.id === id);
  const frame = matches[0];
  if (
    matches.length !== 1 ||
    frame?.localName !== "svg" ||
    frame.namespaceURI !== SVG_NAMESPACE ||
    !frame.hasAttribute("viewBox") ||
    Number(frame.getAttribute("width")) !== width ||
    Number(frame.getAttribute("height")) !== height
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
