import { describe, it, expect } from "vitest";
import { feedChipsFeature } from "../features/feed-chips";
import type { FeedChipsSettings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";
import type { PageCtx } from "../page";

/**
 * Tests for the feed-chips feature — color override + stack layout (home page).
 *
 * Mirrors watch-chips but for the home chip bar (no outer `yt-related-chip-cloud-renderer`
 * scope). Verifies color rules, the stack-layout rules use a bare `yt-chip-cloud-renderer`
 * selector, and liveApplyKeys includes `feedChips.layout`.
 */
const dummyCtx: PageCtx = { page: "home", locale: "de", settings: DEFAULT_SETTINGS };

function cloneFeedChips(): FeedChipsSettings {
    return structuredClone(DEFAULT_SETTINGS.feedChips) as FeedChipsSettings;
}

function css(slice: FeedChipsSettings): string[] {
    const behavior = feedChipsFeature.pages.home;
    return behavior?.css ? behavior.css(slice, dummyCtx) : [];
}

describe("feed-chips feature", () => {
    // * Curated defaults (ADR 0007) ship enabled + red presets — neutralize the slice so
    //   each test states exactly the fields it asserts.
    function neutral(s: FeedChipsSettings): FeedChipsSettings {
        s.activeColor = "default";
        s.inactiveColor = "default";
        return s;
    }

    describe("CSS: color", () => {
        it("emits no rules when disabled", () => {
            const s = cloneFeedChips();
            s.enabled = false;
            expect(css(s)).toEqual([]);
        });

        it("emits active color rule", () => {
            const s = neutral(cloneFeedChips());
            s.enabled = true;
            s.activeColor = "red";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("background-color:#b30024 !important");
            expect(rules[0]).toContain("color:#fff !important");
        });

        it("emits inactive color rule without color override", () => {
            const s = neutral(cloneFeedChips());
            s.enabled = true;
            s.inactiveColor = "blue";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("background-color:#001f4e !important");
            expect(rules[0]).not.toContain("color:#fff");
        });
    });

    describe("CSS: layout hide", () => {
        it("emits no layout rules when layout is collapse", () => {
            const s = neutral(cloneFeedChips());
            s.enabled = true;
            s.layout = "collapse";
            expect(css(s)).toEqual([]);
        });

        it("emits display:none for the home chip bar when layout is hide", () => {
            const s = neutral(cloneFeedChips());
            s.enabled = true;
            s.layout = "hide";
            const rules = css(s);
            expect(rules.length).toBe(1);
            expect(rules[0]).toContain("ytd-feed-filter-chip-bar-renderer");
            expect(rules[0]).toContain("display:none !important");
        });

        it("emits color + hide rules together", () => {
            const s = neutral(cloneFeedChips());
            s.enabled = true;
            s.activeColor = "green";
            s.layout = "hide";
            const rules = css(s);
            expect(rules.length).toBe(2);
            expect(rules[0]).toContain("#007700");
            expect(rules[1]).toContain("display:none");
        });
    });

    describe("validation", () => {
        it("accepts default settings", () => {
            expect(feedChipsFeature.validate!(cloneFeedChips())).toEqual([]);
        });

        it("rejects invalid custom hex", () => {
            const s = cloneFeedChips();
            s.activeColor = "custom";
            s.activeColorHex = "nope";
            const errors = feedChipsFeature.validate!(s);
            expect(errors.map((e) => e.path)).toContain("feedChips.activeColorHex");
        });
    });

    describe("liveApplyKeys", () => {
        it("includes feedChips.layout", () => {
            expect(feedChipsFeature.liveApplyKeys).toContain("feedChips.layout");
        });
    });
});
