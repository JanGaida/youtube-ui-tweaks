import { describe, it, expect } from "vitest";
import { gridStylingFeature, TITLE_SIZE_MAP, META_SIZE_MAP, META_SPACING_MAP } from "../features/grid-styling";
import { DEFAULT_SETTINGS, type StylingSettings } from "../settings";
import type { PageCtx } from "../page";

/**
 * Pure-logic tests for the grid-styling feature validator + typography presets (ADR 0006).
 *
 * Validates enum enforcement on titleSize/metaSize/metaSpacing (free-form rem inputs were
 * replaced by coupled font-size/line-height preset pairs) and preset-pair CSS emission.
 */
describe("grid-styling validate", () => {
    const valid = structuredClone(DEFAULT_SETTINGS.styling);

    it("accepts valid preset values", () => {
        const errors = gridStylingFeature.validate!(valid);
        expect(errors).toEqual([]);
    });

    it("rejects an unknown titleSize", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).titleSize = "huge";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("styling.titleSize");
    });

    it("rejects an unknown metaSize", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).metaSize = "1.35rem";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("styling.metaSize");
    });

    it("rejects an unknown metaSpacing", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).metaSpacing = "0.65rem";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("styling.metaSpacing");
    });

    it("rejects an unknown metaLayout", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).metaLayout = "two-rows";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("styling.metaLayout");
    });

    it("rejects an unknown metaStatsGap", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).metaStatsGap = "16px";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("styling.metaStatsGap");
    });

    it("reports multiple errors at once", () => {
        const s = structuredClone(valid) as StylingSettings;
        (s as unknown as Record<string, unknown>).titleSize = "a";
        (s as unknown as Record<string, unknown>).metaSize = "b";
        (s as unknown as Record<string, unknown>).metaSpacing = "c";
        const errors = gridStylingFeature.validate!(s);
        expect(errors.length).toBe(3);
    });
});

/**
 * Tests for the typography preset pairs — font-size + line-height are coupled per preset
 * (line-clamp / min-height-calc invariants can never break via mismatched pairs).
 */
describe("grid-styling typography presets", () => {
    const dummyCtx: PageCtx = {
        page: "home",
        locale: "de",
        settings: DEFAULT_SETTINGS,
    };

    it("every preset provides a coupled font-size + line-height pair", () => {
        for (const key of ["xsmall", "small", "medium", "large", "xlarge"] as const) {
            expect(TITLE_SIZE_MAP[key]).toBeDefined();
            expect(META_SIZE_MAP[key]).toBeDefined();
            // * line-height ≥ font-size at every preset — text never clips vertically.
            expect(parseFloat(TITLE_SIZE_MAP[key].lineHeight)).toBeGreaterThanOrEqual(
                parseFloat(TITLE_SIZE_MAP[key].fontSize),
            );
            expect(parseFloat(META_SIZE_MAP[key].lineHeight)).toBeGreaterThanOrEqual(
                parseFloat(META_SIZE_MAP[key].fontSize),
            );
        }
    });

    it("metaSpacing has 3 presets with ascending padding", () => {
        const vals = [META_SPACING_MAP.tight, META_SPACING_MAP.normal, META_SPACING_MAP.relaxed].map(parseFloat);
        expect(vals[0]).toBeLessThan(vals[1]);
        expect(vals[1]).toBeLessThan(vals[2]);
    });

    it("default settings (medium) emit the exact default pair values", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const titleRule = css.find((r) => r.includes(".ytLockupMetadataViewModelTitle {"));
        expect(titleRule).toContain("font-size: 1.35rem");
        expect(titleRule).toContain("line-height: 1.85rem");
        const metaRule = css.find((r) => r.includes(".ytContentMetadataViewModelMetadataText {"));
        expect(metaRule).toContain("font-size: 1.15rem");
        expect(metaRule).toContain("line-height: 1.15rem");
        const padRule = css.find((r) => r.includes("padding-top"));
        expect(padRule).toContain("padding-top: 0.65rem");
    });

    it("emits the preset pair values, not free-form inputs (xsmall title, relaxed spacing)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.titleSize = "xsmall";
        s.metaSpacing = "relaxed";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const titleRule = css.find((r) => r.includes(".ytLockupMetadataViewModelTitle {"));
        expect(titleRule).toContain("font-size: 1.1rem");
        expect(titleRule).toContain("line-height: 1.5rem");
        const padRule = css.find((r) => r.includes("padding-top"));
        expect(padRule).toContain("padding-top: 0.95rem");
    });

    it("title rule emits no margins (margins are removed — ADR 0006; avatar margin stays)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        // * No TITLE rule may carry margins — the avatar margin-right (channel icon) is untouched.
        const titleRules = css.filter((r) => r.includes("MetadataViewModelTitle"));
        expect(titleRules.length).toBeGreaterThan(0);
        expect(titleRules.every((r) => !r.includes("margin-left") && !r.includes("margin-right"))).toBe(true);
    });

    it("unknown preset values fall back to medium/normal (no undefined in CSS)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        (s as unknown as Record<string, unknown>).titleSize = "garbage";
        (s as unknown as Record<string, unknown>).metaSpacing = "garbage";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const titleRule = css.find((r) => r.includes(".ytLockupMetadataViewModelTitle {"));
        expect(titleRule).toContain("font-size: 1.35rem");
        const padRule = css.find((r) => r.includes("padding-top"));
        expect(padRule).toContain("padding-top: 0.65rem");
    });
});

/**
 * Tests for the forceEqualHeight CSS rule — uses title min-height (reserves max-lines worth of
 * space) + margin-top:auto on the menu button (pushes spare space to the bottom). Skipped for "99".
 */
describe("grid-styling forceEqualHeight CSS", () => {
    const dummyCtx: PageCtx = {
        page: "home",
        locale: "de",
        settings: DEFAULT_SETTINGS,
    };
    // * The stretch rule targets the grid renderer (modern YT has no ytd-rich-grid-row).
    const findStretchRule = (css: string[]): string | undefined => css.find((r) => r.includes("align-items: stretch"));
    const findMinHeightRule = (css: string[]): string | undefined => css.find((r) => r.includes("min-height: calc"));
    const findMarginTopAutoRule = (css: string[]): string | undefined =>
        css.find((r) => r.includes("margin-top: auto") && r.includes("MenuButton"));

    it("emits stretch + min-height + margin-top-auto rules when forceEqualHeight is true and titleMaxLines is set", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.forceEqualHeight = true;
        s.titleMaxLines = "2";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const stretchRule = findStretchRule(css);
        expect(stretchRule).toBeDefined();
        expect(stretchRule).toContain("ytd-rich-grid-renderer");
        expect(findMinHeightRule(css)).toBeDefined();
        expect(findMarginTopAutoRule(css)).toBeDefined();
    });

    it("min-height rule uses the preset lineHeight * titleMaxLines", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.forceEqualHeight = true;
        s.titleMaxLines = "3";
        s.titleSize = "medium";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const rule = findMinHeightRule(css);
        expect(rule).toContain("calc(1.85rem * 3)");
    });

    it("title rule owns the FULL clamp chain (max-height matches preset lineHeight × lines — bug #1)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.titleMaxLines = "3";
        s.titleSize = "medium";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const titleRule = css.find((r) => r.includes(".ytLockupMetadataViewModelTitle {"));
        // * Native max-height (dimensioned for YT's native line-height) half-cut the 3rd line
        //   when our preset lines are taller — we must own the whole chain.
        expect(titleRule).toContain("-webkit-line-clamp: 3");
        expect(titleRule).toContain("max-height: calc(1.85rem * 3)");
        expect(titleRule).toContain("overflow: hidden");
        expect(titleRule).toContain("display: -webkit-box");
        expect(titleRule).toContain("-webkit-box-orient: vertical");
    });

    it('"99" (all lines) releases the clamp entirely (no max-height, clamp unset)', () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.titleMaxLines = "99";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        const titleRule = css.find((r) => r.includes(".ytLockupMetadataViewModelTitle {"));
        expect(titleRule).toContain("-webkit-line-clamp: unset");
        expect(titleRule).toContain("max-height: none");
        expect(titleRule).not.toContain("calc(1.85rem * 99)");
    });

    it("does not emit stretch rule when forceEqualHeight is false", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.forceEqualHeight = false;
        s.titleMaxLines = "2";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        expect(findStretchRule(css)).toBeUndefined();
        expect(findMinHeightRule(css)).toBeUndefined();
        expect(findMarginTopAutoRule(css)).toBeUndefined();
    });

    it("does not emit stretch rule when titleMaxLines is '99' (all lines)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.forceEqualHeight = true;
        s.titleMaxLines = "99";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        expect(findStretchRule(css)).toBeUndefined();
        expect(findMinHeightRule(css)).toBeUndefined();
        expect(findMarginTopAutoRule(css)).toBeUndefined();
    });

    it("does not emit title/meta CSS when styling is disabled (avatar/menu still emit)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = false;
        s.forceEqualHeight = true;
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        // * titleMetaCss returns [] when disabled — no title/meta rules, no forceEqualHeight.
        expect(css.find((r) => r.includes(".ytLockupMetadataViewModelTitle"))).toBeUndefined();
        expect(findStretchRule(css)).toBeUndefined();
        expect(findMinHeightRule(css)).toBeUndefined();
    });
});

/**
 * Tests for the metaLayout:"split" companion CSS (break box, views gap, delimiter
 * displacement — analysis 2026-10-24). The DOM pass itself lives in meta-split.test.ts.
 */
describe("grid-styling metaLayout split CSS", () => {
    const dummyCtx: PageCtx = {
        page: "home",
        locale: "de",
        settings: DEFAULT_SETTINGS,
    };

    const splitCss = (overrides?: (s: StylingSettings) => void): string[] => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.metaLayout = "split";
        overrides?.(s);
        return gridStylingFeature.pages.home!.css!(s, dummyCtx);
    };

    it("emits break box + views gap + delimiter displacement when split is on", () => {
        const css = splitCss();
        expect(css).toContain(
            `.ytContentMetadataViewModelMetadataRow .yt-tweaks-rowbreak { display: block !important; height: 0 !important; }`,
        );
        expect(css).toContain(`[data-yt-tweaks-views] { margin-inline-end: 16px !important; }`);
        expect(css).toContain(
            `[data-yt-tweaks-views] + .ytContentMetadataViewModelDelimiter { display: none !important; }`,
        );
    });

    it("normalizes delimiter spacing (measured live: YT margin 4px/4px per delimiter, empty multi-channel ones → ~8px double-space)", () => {
        const css = splitCss();
        // * Margins neutralized so delimiters only contribute their text content.
        expect(css).toContain(
            `.ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter { margin: 0 !important; padding: 0 !important; }`,
        );
        // * EMPTY delimiters get a real space char — the join matches single-channel rows.
        expect(css).toContain(
            `.ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter:empty::before { content: " " !important; }`,
        );
    });

    it("emits the gap from the preset map (tight 8 / relaxed 24)", () => {
        const tight = splitCss((s) => (s.metaStatsGap = "tight"));
        expect(tight).toContain(`[data-yt-tweaks-views] { margin-inline-end: 8px !important; }`);
        const relaxed = splitCss((s) => (s.metaStatsGap = "relaxed"));
        expect(relaxed).toContain(`[data-yt-tweaks-views] { margin-inline-end: 24px !important; }`);
    });

    it("emits NO split rules for mixed layout (status quo)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.enabled = true;
        s.metaLayout = "mixed";
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        expect(css.find((r) => r.includes("yt-tweaks-rowbreak"))).toBeUndefined();
        expect(css.find((r) => r.includes("margin-inline-end"))).toBeUndefined();
        expect(css.find((r) => r.includes("ytContentMetadataViewModelDelimiter"))).toBeUndefined();
    });

    it("forces inline flow for the row (never flex) while split is on", () => {
        const css = splitCss((s) => (s.metaAlign = "block"));
        const rowRule = css.find((r) => r.includes(".ytContentMetadataViewModelMetadataRow {"));
        expect(rowRule).toContain("display: block !important");
        expect(css.find((r) => r.includes("justify-content: space-between"))).toBeUndefined();
    });

    it('maps metaAlign "block" to start while split is on (no per-line meaning — user decision)', () => {
        const css = splitCss((s) => (s.metaAlign = "block"));
        const rowRule = css.find((r) => r.includes(".ytContentMetadataViewModelMetadataRow {"));
        expect(rowRule).toContain("text-align: left !important");
    });

    it("keeps metaAlign left/center/right semantics while split is on (both lines follow)", () => {
        const css = splitCss((s) => (s.metaAlign = "center"));
        const rowRule = css.find((r) => r.includes(".ytContentMetadataViewModelMetadataRow {"));
        expect(rowRule).toContain("text-align: center !important");
    });

    it("owns the split companion CSS + shared restore; the DOM pass lives in the meta-split feature", () => {
        expect(gridStylingFeature.pages.home!.css).toBeDefined();
        expect(gridStylingFeature.pages.home!.restore).toBeDefined();
        expect(gridStylingFeature.pages.home!.run).toBeUndefined();
        expect(gridStylingFeature.liveApplyKeys).toContain("styling.metaLayout");
        expect(gridStylingFeature.liveApplyKeys).toContain("styling.metaStatsGap");
    });
});

/**
 * Tests for the menuButton CSS rework:
 * - sizing targets ONLY the <button>, never the wrapper (wrapper margin must stay native —
 *   overriding it made the button jump into the corner),
 * - padding zeroed + border-radius 50% so the hover circle stays round at every size,
 * - icon scales proportionally at the native 1:1.5 ratio (36px button / 24px icon),
 * - feedback layer is inset-covered and round.
 */
describe("grid-styling menuButton CSS", () => {
    const dummyCtx: PageCtx = {
        page: "home",
        locale: "de",
        settings: DEFAULT_SETTINGS,
    };

    const menuCss = (size: string, enabled = true): string[] => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.menuButton.enabled = enabled;
        s.menuButton.size = size as StylingSettings["menuButton"]["size"];
        // * Isolate the menu rules from the curated forceEqualHeight default (its stretch
        //   rule targets the MenuButton wrapper and would leak into these assertions).
        s.forceEqualHeight = false;
        return gridStylingFeature.pages.home!.css!(s, dummyCtx);
    };

    it("hides the menu button via wrapper display:none", () => {
        const s = structuredClone(DEFAULT_SETTINGS.styling) as StylingSettings;
        s.menuButton.enabled = true;
        s.menuButton.hide = true;
        const css = gridStylingFeature.pages.home!.css!(s, dummyCtx);
        expect(css).toContain(`.ytLockupMetadataViewModelMenuButton { display: none !important; }`);
    });

    it("emits no menu rules when menuButton is disabled", () => {
        const css = menuCss("medium", false);
        expect(css.find((r) => r.includes("MenuButton"))).toBeUndefined();
    });

    it("sizes the button to the preset and zeroes padding with border-radius 50%", () => {
        const css = menuCss("large");
        const btn = css.find((r) => r.includes("button.ytSpecButtonShapeNextIconButton {"));
        expect(btn).toBeDefined();
        expect(btn).toContain("width: 32px");
        expect(btn).toContain("height: 32px");
        expect(btn).toContain("padding: 0 !important");
        expect(btn).toContain("border-radius: 50% !important");
    });

    it("scales the icon at the native 1:1.5 ratio", () => {
        const css = menuCss("large");
        const icon = css.find((r) => r.includes(".ytSpecButtonShapeNextIcon {"));
        expect(icon).toBeDefined();
        expect(icon).toContain("calc(32px / 1.5)");
    });

    it("never overrides the wrapper margin (no jumping into the corner)", () => {
        const css = menuCss("xlarge");
        const wrapperRules = css.filter((r) => r.startsWith(".ytLockupMetadataViewModelMenuButton {"));
        expect(wrapperRules.length).toBe(0);
        expect(css.find((r) => r.includes("MenuButton { margin"))).toBeUndefined();
    });

    it("covers the feedback layer absolutely and round", () => {
        const css = menuCss("medium");
        const feedback = css.find((r) => r.includes("yt-touch-feedback-shape {"));
        expect(feedback).toBeDefined();
        expect(feedback).toContain("position: absolute !important");
        expect(feedback).toContain("inset: 0 !important");
        expect(feedback).toContain("border-radius: 50% !important");
    });
});
