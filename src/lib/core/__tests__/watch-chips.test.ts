// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { watchChipsFeature } from "../features/watch-chips";
import type { WatchChipsSettings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";
import type { PageCtx } from "../page";

/**
 * Tests for the watch-chips feature — CSS rule generation + hex validation.
 *
 * Mirrors feed-chips (pure-CSS color override) but scoped to the watch-page related-chip bar
 * (`yt-related-chip-cloud-renderer`). Verifies the CSS is emitted only when enabled, scoped to
 * the related-chip renderer, and applies the preset/custom colors to active + inactive chips.
 * Validator mirrors feed-chips (custom-hex regex when mode === "custom").
 */
const dummyCtx: PageCtx = { page: "watch", locale: "de", settings: DEFAULT_SETTINGS };

function cloneWatchChips(): WatchChipsSettings {
    return structuredClone(DEFAULT_SETTINGS.watchChips) as WatchChipsSettings;
}

/** Extracts the CSS behavior (watch page). */
function css(slice: WatchChipsSettings): string[] {
    const behavior = watchChipsFeature.pages.watch;
    return behavior?.css ? behavior.css(slice, dummyCtx) : [];
}

describe("watch-chips feature", () => {
    // * Curated defaults (ADR 0007) ship enabled + red presets + stack layout — neutralize
    //   the slice so each test states exactly the fields it asserts.
    function neutral(s: WatchChipsSettings): WatchChipsSettings {
        s.activeColor = "default";
        s.inactiveColor = "default";
        s.layout = "collapse";
        return s;
    }

    describe("CSS generation", () => {
        it("emits no rules when disabled", () => {
            const s = cloneWatchChips();
            s.enabled = false;
            expect(css(s)).toEqual([]);
        });

        it("emits no rules when enabled but both colors are default", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.activeColor = "default";
            s.inactiveColor = "default";
            expect(css(s)).toEqual([]);
        });

        it("emits active rule scoped to yt-related-chip-cloud-renderer", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.activeColor = "red";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("yt-related-chip-cloud-renderer");
            expect(rules[0]).toContain("background-color:#b30024 !important");
            expect(rules[0]).toContain("color:#fff !important");
        });

        it("emits inactive rule scoped to yt-related-chip-cloud-renderer", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.inactiveColor = "blue";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("yt-related-chip-cloud-renderer");
            expect(rules[0]).toContain("background-color:#001f4e !important");
            expect(rules[0]).not.toContain("color:#fff");
        });

        it("uses custom hex when mode is custom", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.activeColor = "custom";
            s.activeColorHex = "#abcdef";
            const rules = css(s);
            expect(rules[0]).toContain("background-color:#abcdef !important");
        });

        it("emits both active + inactive rules when both set", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.activeColor = "green";
            s.inactiveColor = "orange";
            const rules = css(s);
            expect(rules.length).toBe(2);
            expect(rules[0]).toContain("#007700");
            expect(rules[1]).toContain("#4e2900");
        });
    });

    describe("layout: stack", () => {
        it("emits no layout rules when layout is collapse (default)", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.layout = "collapse";
            const rules = css(s);
            // * No color set either → empty.
            expect(rules).toEqual([]);
        });

        it("emits stack layout rules when layout is stack", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.layout = "stack";
            const rules = css(s);
            // * 6 stack rules (bar height, row, scroll-container, chips, arrows, chip margin).
            expect(rules.length).toBe(6);
            const joined = rules.join("\n");
            expect(joined).toContain("yt-related-chip-cloud-renderer");
            expect(joined).toContain("#container");
            expect(joined).toContain("height:auto");
            expect(joined).toContain("flex-direction:column");
            expect(joined).toContain("overflow:visible");
            expect(joined).toContain("transform:none");
            expect(joined).toContain("white-space:normal");
            expect(joined).toContain("flex-wrap:wrap");
            expect(joined).toContain("display:none");
            expect(joined).toContain("margin: 0 4px 4px 0");
        });

        it("stack rules are scoped to yt-related-chip-cloud-renderer", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.layout = "stack";
            const rules = css(s);
            for (const r of rules) {
                expect(r).toContain("yt-related-chip-cloud-renderer");
            }
        });

        it("emits color + stack rules together", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.activeColor = "red";
            s.layout = "stack";
            const rules = css(s);
            // * 1 color rule + 6 stack rules.
            expect(rules.length).toBe(7);
            expect(rules[0]).toContain("background-color:#b30024");
            expect(rules[1]).toContain("height:auto");
        });
    });

    describe("layout: hide", () => {
        it("emits display:none for the related-chip renderer when layout is hide", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.layout = "hide";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("yt-related-chip-cloud-renderer");
            expect(rules[0]).toContain("display:none !important");
        });

        it("emits color + hide rules together", () => {
            const s = neutral(cloneWatchChips());
            s.enabled = true;
            s.inactiveColor = "blue";
            s.layout = "hide";
            const rules = css(s);
            expect(rules.length).toBe(2);
            expect(rules[0]).toContain("#001f4e");
            expect(rules[1]).toContain("display:none");
        });
    });

    describe("validation", () => {
        it("accepts default settings", () => {
            expect(watchChipsFeature.validate!(cloneWatchChips())).toEqual([]);
        });

        it("accepts valid custom hex when mode is custom", () => {
            const s = cloneWatchChips();
            s.activeColor = "custom";
            s.activeColorHex = "#ff0033";
            expect(watchChipsFeature.validate!(s)).toEqual([]);
        });

        it("rejects invalid active hex when mode is custom", () => {
            const s = cloneWatchChips();
            s.activeColor = "custom";
            s.activeColorHex = "not-a-hex";
            const errors = watchChipsFeature.validate!(s);
            expect(errors.map((e) => e.path)).toContain("watchChips.activeColorHex");
        });

        it("rejects invalid inactive hex when mode is custom", () => {
            const s = cloneWatchChips();
            s.inactiveColor = "custom";
            s.inactiveColorHex = "#xyz";
            const errors = watchChipsFeature.validate!(s);
            expect(errors.map((e) => e.path)).toContain("watchChips.inactiveColorHex");
        });

        it("accepts #rrggbbaa 8-digit hex", () => {
            const s = cloneWatchChips();
            s.activeColor = "custom";
            s.activeColorHex = "#ff003380";
            expect(watchChipsFeature.validate!(s)).toEqual([]);
        });
    });

    describe("page scope", () => {
        it("has no behavior on the home page", () => {
            const homeCtx: PageCtx = { page: "home", locale: "de", settings: DEFAULT_SETTINGS };
            const behavior = watchChipsFeature.pages.home;
            expect(behavior).toBeUndefined();
            // * Confirm via resolveBehavior-style lookup that home has no css.
            const fallback = watchChipsFeature.pages["*"];
            expect(fallback).toBeUndefined();
            void homeCtx;
        });
    });

    describe("liveApplyKeys", () => {
        it("lists all watch-chips settings paths", () => {
            expect(watchChipsFeature.liveApplyKeys).toEqual([
                "watchChips.enabled",
                "watchChips.activeColor",
                "watchChips.activeColorHex",
                "watchChips.inactiveColor",
                "watchChips.inactiveColorHex",
                "watchChips.layout",
            ]);
        });
    });
});
