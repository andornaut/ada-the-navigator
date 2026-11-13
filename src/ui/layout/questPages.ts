/** Long prose continues on another page; every source character remains represented. */
export function questTextParts(fits: (text: string) => boolean, text: string): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest && !fits(rest)) {
    let low = 1;
    let high = rest.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(rest.slice(0, middle))) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const word = rest.lastIndexOf(" ", low - 1);
    const end = word > 0 ? word + 1 : low;
    parts.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) {
    parts.push(rest);
  }
  return parts;
}
