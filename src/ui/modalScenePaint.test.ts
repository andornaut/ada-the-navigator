import { expect, it, vi } from "vitest";

import { createCoveredPaint } from "./modalScenePaint.ts";

it("retains only the last admitted presentation without reading under cover", () => {
  const paint = createCoveredPaint<string>();
  const flight = {};
  const read = vi.fn(() => ["known"]);
  expect(paint(flight, true, true, read)).toEqual([]);
  expect(read).not.toHaveBeenCalled();
  expect(paint(flight, false, true, read)).toEqual(["known"]);
  read.mockReturnValue(["new"]);
  expect(paint(flight, true, true, read)).toEqual(["known"]);
  expect(read).toHaveBeenCalledOnce();
  expect(paint(flight, false, true, read)).toEqual(["new"]);
});
it("does not carry paint into a different flight, actual scene replacement or emergency", () => {
  const paint = createCoveredPaint<string>();
  const flight = {};
  const read = vi.fn(() => ["known"]);
  paint(flight, false, true, read);
  expect(paint({}, true, true, read)).toEqual([]);
  expect(paint(flight, true, true, read)).toEqual([]);
  paint(flight, false, true, read);
  expect(paint(flight, true, false, read)).toEqual([]);
  expect(paint(null, true, true, read)).toEqual([]);
  expect(read).toHaveBeenCalledTimes(2);
});
