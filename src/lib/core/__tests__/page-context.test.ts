// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { initPageContext, onPageChange, recomputePageCtx } from "../page";
import { DEFAULT_SETTINGS } from "../settings";
import { setLogLevel } from "../log";

/**
 * Runtime PageContext tests — listener notification + failure isolation.
 *
 * jsdom: initPageContext/recomputePageCtx read `location`/`document` and the logger uses
 * `console.error`. The module keeps singleton state, so initialization happens once.
 */
describe("PageContext runtime", () => {
    const unsubs: Array<() => void> = [];

    beforeAll(() => {
        window.history.replaceState({}, "", "/");
        document.documentElement.lang = "de";
        initPageContext(structuredClone(DEFAULT_SETTINGS));
    });

    afterEach(() => {
        while (unsubs.length > 0) unsubs.pop()?.();
        setLogLevel("silent");
        vi.restoreAllMocks();
    });

    it("keeps notifying listeners after one listener throws", () => {
        setLogLevel("error");
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const good = vi.fn();

        unsubs.push(
            onPageChange(() => {
                throw new Error("listener boom");
            }),
        );
        unsubs.push(onPageChange(good));

        window.history.replaceState({}, "", "/watch?v=abc123");
        recomputePageCtx();

        expect(good).toHaveBeenCalledOnce();
        expect(errorSpy).toHaveBeenCalled();

        const payload = errorSpy.mock.calls.at(-1)?.at(-1) as Record<string, unknown>;
        expect(payload.navSeq).toEqual(expect.any(Number));
        expect(payload.error).toBeTruthy();
    });

    it("does not notify when page and locale are unchanged", () => {
        const listener = vi.fn();
        unsubs.push(onPageChange(listener));

        recomputePageCtx();

        expect(listener).not.toHaveBeenCalled();
    });
});
