import { describe, it, expect } from "vitest";
import { detectPage } from "../page";

/**
 * Pure-logic tests for `detectPage` — URL + DOM-cue matrix. No DOM/browser env required.
 *
 * Validates every URL pattern branch and the DOM-cue confirmation edge case.
 */
describe("detectPage", () => {
    const base = "https://www.youtube.com";

    it("detects watch from /watch?v=", () => {
        expect(detectPage(`${base}/watch?v=abc123`)).toBe("watch");
    });

    it("detects subscriptions from /feed/subscriptions", () => {
        expect(detectPage(`${base}/feed/subscriptions`)).toBe("subscriptions");
    });

    it("detects search from /results?search_query=x", () => {
        expect(detectPage(`${base}/results?search_query=test`)).toBe("search");
    });

    it("detects shorts from /shorts/<id>", () => {
        expect(detectPage(`${base}/shorts/abc123`)).toBe("shorts");
    });

    it("detects channel from /@name handle", () => {
        expect(detectPage(`${base}/@SomeChannel`)).toBe("channel");
    });

    it("detects channel from /channel/ID", () => {
        expect(detectPage(`${base}/channel/UCxxxx`)).toBe("channel");
    });

    it("detects channel from /c/CustomName", () => {
        expect(detectPage(`${base}/c/SomeChannel`)).toBe("channel");
    });

    it("detects channel from /user/Name", () => {
        expect(detectPage(`${base}/user/SomeUser`)).toBe("channel");
    });

    it("detects home from root", () => {
        expect(detectPage(`${base}/`)).toBe("home");
    });

    it("detects home from /feed/trending (fallback)", () => {
        expect(detectPage(`${base}/feed/trending`)).toBe("home");
    });

    it("detects home from /feed/history (fallback)", () => {
        expect(detectPage(`${base}/feed/history`)).toBe("home");
    });

    it("detects home from relative URL when no base provided internally", () => {
        expect(detectPage("/")).toBe("home");
    });

    it("falls back to home for malformed URL", () => {
        expect(detectPage("not-a-url")).toBe("home");
    });

    it("DOM cue confirms watch when URL is ambiguous", () => {
        expect(detectPage(`${base}/`, { has: (sel) => sel === "ytd-watch-flexy" })).toBe("watch");
    });

    it("rich-grid DOM cue confirms home even when watch-flexy lingers (back-nav)", () => {
        // * YouTube keeps ytd-watch-flexy in the DOM after leaving watch (fast back-nav cache).
        //   ytd-rich-grid-renderer exists only on grid pages → it discriminates home from the
        //   lingering watch element. Without this, home-only CSS features break on back-nav.
        expect(
            detectPage(`${base}/`, {
                has: (sel) => sel === "ytd-rich-grid-renderer" || sel === "ytd-watch-flexy",
            }),
        ).toBe("home");
    });

    it("rich-grid cue confirms home on root URL", () => {
        expect(detectPage(`${base}/`, { has: (sel) => sel === "ytd-rich-grid-renderer" })).toBe("home");
    });

    it("DOM cue does not override an explicit non-watch URL", () => {
        expect(detectPage(`${base}/results`, { has: (sel) => sel === "ytd-watch-flexy" })).toBe("search");
    });

    it("DOM cue absent does not change home detection", () => {
        expect(detectPage(`${base}/`, { has: () => false })).toBe("home");
    });

    it("never returns the wildcard '*'", () => {
        for (const path of ["/", "/watch?v=x", "/@x", "/feed/subscriptions", "/results", "/shorts/x"]) {
            const result = detectPage(`${base}${path}`);
            expect(result).not.toBe("*");
        }
    });
});
