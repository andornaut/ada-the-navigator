import { describe, expect, it, vi } from "vitest";

import { createUpdateOffer } from "./updateOffer.ts";

function fixture() {
  const save = vi.fn();
  const switching = vi.fn();
  const offer = createUpdateOffer({ save, switching });
  const visible: boolean[] = [];
  const stop = offer.subscribe((shown) => visible.push(shown));
  const staged = (version = "next") => ({
    dismiss: vi.fn(),
    updateNow: vi.fn(async (before: () => void | PromiseLike<void>) => {
      await before();
    }),
    version,
  });
  return { offer, save, staged, stop, switching, visible };
}

describe("in-session update offer", () => {
  it("shows a staged version at once, wherever the player is", () => {
    const f = fixture();
    expect(f.visible).toEqual([false]);
    f.offer.offer(f.staged());
    expect(f.visible).toEqual([false, true]);
  });

  it("saves before Update now switches, once per showing", async () => {
    const f = fixture();
    const update = f.staged();
    f.offer.offer(update);
    f.offer.accept();
    f.offer.accept();
    f.offer.defer();
    expect(f.visible).toEqual([false, true, false]);
    expect(f.switching).toHaveBeenCalledExactlyOnceWith(true);
    expect(update.updateNow).toHaveBeenCalledOnce();
    expect(f.save).toHaveBeenCalledOnce();
    expect(update.dismiss).not.toHaveBeenCalled();
  });

  it("ends the switch and keeps play on the active build when the staged build has gone", async () => {
    const f = fixture();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const update = { ...f.staged(), updateNow: vi.fn(() => Promise.reject(new Error("gone"))) };
    f.offer.offer(update);
    f.offer.accept();
    await vi.waitFor(() => expect(f.switching).toHaveBeenLastCalledWith(false));
    expect(f.visible.at(-1)).toBe(false);
  });

  it("dismisses once and offers a newer staged version again", () => {
    const f = fixture();
    const first = f.staged("one");
    f.offer.offer(first);
    f.offer.defer();
    f.offer.defer();
    f.offer.accept();
    expect(first.dismiss).toHaveBeenCalledOnce();
    expect(first.updateNow).not.toHaveBeenCalled();
    const second = f.staged("two");
    f.offer.offer(second);
    expect(f.visible).toEqual([false, true, false, true]);
    f.offer.accept();
    expect(second.updateNow).toHaveBeenCalledOnce();
  });

  it("does nothing on accept or defer while hidden, and stops calling an unsubscribed listener", () => {
    const f = fixture();
    f.offer.accept();
    f.offer.defer();
    expect(f.switching).not.toHaveBeenCalled();
    f.stop();
    f.offer.offer(f.staged());
    expect(f.visible).toEqual([false]);
  });
});
