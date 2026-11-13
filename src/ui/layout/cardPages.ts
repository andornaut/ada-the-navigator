/** Pack measured blocks without splitting controls or changing their reading order. */
export function cardPages(available: number, gap: number, heights: readonly number[]): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  for (const [index, height] of heights.entries()) {
    const next = height + (page.length ? gap : 0);
    if (page.length && used + next > available) {
      pages.push(page);
      page = [];
      used = 0;
    }
    used += height + (page.length ? gap : 0);
    page.push(index);
  }
  if (page.length) {
    pages.push(page);
  }
  return pages.length ? pages : [[]];
}
