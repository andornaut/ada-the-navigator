import { ObsoleteUpdateOfferError } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
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
    expect(f.visible).toEqual([false, true]);
    expect(f.switching).toHaveBeenCalledExactlyOnceWith(true);
    expect(update.updateNow).toHaveBeenCalledOnce();
    expect(f.save).toHaveBeenCalledOnce();
    expect(update.dismiss).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(f.visible).toEqual([false, true, false]));
  });

  it("dismisses a matching obsolete offer without warning or presenting another offer", async () => {
    const f = fixture();
    const error = new ObsoleteUpdateOfferError("next");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const update = { ...f.staged(), updateNow: vi.fn(() => Promise.reject(error)) };
    f.offer.offer(update);
    f.offer.accept();
    await vi.waitFor(() => expect(f.visible).toEqual([false, true, false]));
    expect(f.switching.mock.calls).toEqual([[true], [false]]);
    expect(update.dismiss).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the newer offer when a shared switch rejects for an older version", async () => {
    const f = fixture();
    const update = f.staged("newer");
    update.updateNow.mockRejectedValueOnce(new ObsoleteUpdateOfferError("older"));
    f.offer.offer(update);
    f.offer.accept();
    await vi.waitFor(() => expect(f.switching.mock.calls).toEqual([[true], [false]]));
    expect(f.visible).toEqual([false, true]);
    expect(update.dismiss).not.toHaveBeenCalled();
    f.offer.accept();
    await vi.waitFor(() => expect(f.visible).toEqual([false, true, false]));
    expect(update.updateNow).toHaveBeenCalledTimes(2);
  });

  it("does not close a replacement while an obsolete accepted offer settles", async () => {
    const f = fixture();
    const old = f.staged("old");
    const newer = f.staged("newer");
    let reject!: (reason: unknown) => void;
    const pending = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    old.updateNow.mockReturnValueOnce(pending);
    f.offer.offer(old);
    f.offer.accept();
    f.offer.offer(newer);
    f.offer.accept();
    expect(newer.updateNow).not.toHaveBeenCalled();
    reject(new ObsoleteUpdateOfferError(old.version));
    await vi.waitFor(() => expect(f.switching).toHaveBeenLastCalledWith(false));
    expect(f.visible).toEqual([false, true]);
    expect(old.dismiss).not.toHaveBeenCalled();
    expect(newer.dismiss).not.toHaveBeenCalled();
    f.offer.accept();
    expect(newer.updateNow).toHaveBeenCalledOnce();
  });

  it("keeps the genuine save failure on the warning path and closes the offer", async () => {
    const f = fixture();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new Error("save unavailable");
    const update = { ...f.staged(), updateNow: vi.fn(() => Promise.reject(error)) };
    f.offer.offer(update);
    f.offer.accept();
    await vi.waitFor(() => expect(f.switching).toHaveBeenLastCalledWith(false));
    expect(f.visible.at(-1)).toBe(false);
    expect(warn).toHaveBeenCalledExactlyOnceWith("Update now could not switch builds.", error);
    expect(update.dismiss).not.toHaveBeenCalled();
    warn.mockRestore();
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
