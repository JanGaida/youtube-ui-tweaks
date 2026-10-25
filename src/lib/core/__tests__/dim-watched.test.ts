import { describe, it, expect } from "vitest";
import {
    dimWatchedFeature,
    THUMB_OPACITY,
    TEXT_OPACITY,
    quantizeProgress,
    bucketFactor,
} from "../features/dim-watched";
import { DEFAULT_SETTINGS, type DimWatchedSettings } from "../settings";

/**
 * Pure-logic tests for the dim-watched feature helpers + validator.
 *
 * Covers: thumb/text opacity maps, progress quantization (downward bucketing per D1),
 * validation (brightness + progressSteps), and CSS output (bucket-scaled marker-scoped rules).
 */
describe("dim-watched helpers", () => {
    describe("THUMB_OPACITY", () => {
        it("provides 4 presets with descending opacity (stronger dim = more faded image)", () => {
            const vals = [THUMB_OPACITY.subtle, THUMB_OPACITY.light, THUMB_OPACITY.medium, THUMB_OPACITY.strong];
            expect(vals).toHaveLength(4);
            for (let i = 1; i < vals.length; i++) {
                expect(vals[i]).toBeLessThan(vals[i - 1]);
            }
        });

        it("subtle = 0.7, strong = 0.25", () => {
            expect(THUMB_OPACITY.subtle).toBe(0.7);
            expect(THUMB_OPACITY.strong).toBe(0.25);
        });
    });

    describe("TEXT_OPACITY", () => {
        it("provides 4 presets with descending opacity (stronger dim = less text)", () => {
            const vals = [TEXT_OPACITY.subtle, TEXT_OPACITY.light, TEXT_OPACITY.medium, TEXT_OPACITY.strong];
            expect(vals).toHaveLength(4);
            for (let i = 1; i < vals.length; i++) {
                expect(vals[i]).toBeLessThan(vals[i - 1]);
            }
        });

        it("subtle = 0.6, strong = 0.15", () => {
            expect(TEXT_OPACITY.subtle).toBe(0.6);
            expect(TEXT_OPACITY.strong).toBe(0.15);
        });
    });
});

describe("dim-watched validate", () => {
    const valid = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;

    it("accepts valid default config", () => {
        const errors = dimWatchedFeature.validate!(valid);
        expect(errors).toEqual([]);
    });

    it("accepts all 4 brightness values", () => {
        for (const brightness of ["subtle", "light", "medium", "strong"]) {
            const s = structuredClone(valid) as DimWatchedSettings;
            s.brightness = brightness as DimWatchedSettings["brightness"];
            const errors = dimWatchedFeature.validate!(s);
            expect(errors).toEqual([]);
        }
    });

    it("rejects unknown brightness", () => {
        const s = structuredClone(valid) as DimWatchedSettings;
        (s as unknown as Record<string, unknown>).brightness = "extreme";
        const errors = dimWatchedFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("dimWatched.brightness");
    });

    it("rejects non-boolean hoverReveal", () => {
        const s = structuredClone(valid) as DimWatchedSettings;
        (s as unknown as Record<string, unknown>).hoverReveal = "yes";
        const errors = dimWatchedFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("dimWatched.hoverReveal");
    });

    it("accepts all 4 progressSteps values", () => {
        for (const steps of ["off", "quarter", "third", "half"]) {
            const s = structuredClone(valid) as DimWatchedSettings;
            s.progressSteps = steps as DimWatchedSettings["progressSteps"];
            const errors = dimWatchedFeature.validate!(s);
            expect(errors).toEqual([]);
        }
    });

    it("rejects unknown progressSteps", () => {
        const s = structuredClone(valid) as DimWatchedSettings;
        (s as unknown as Record<string, unknown>).progressSteps = "fifth";
        const errors = dimWatchedFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("dimWatched.progressSteps");
    });
});

describe("quantizeProgress (downward quantization, D1)", () => {
    it("off always returns 100 (legacy full veil)", () => {
        expect(quantizeProgress(0, "off")).toBe(100);
        expect(quantizeProgress(24, "off")).toBe(100);
        expect(quantizeProgress(100, "off")).toBe(100);
    });

    it("quarter floors into 25/50/75/100 buckets", () => {
        expect(quantizeProgress(24, "quarter")).toBe(0);
        expect(quantizeProgress(25, "quarter")).toBe(25);
        expect(quantizeProgress(49, "quarter")).toBe(25);
        expect(quantizeProgress(50, "quarter")).toBe(50);
        expect(quantizeProgress(74, "quarter")).toBe(50);
        expect(quantizeProgress(81, "quarter")).toBe(75);
        expect(quantizeProgress(100, "quarter")).toBe(100);
    });

    it("third floors into 33/66/100 buckets", () => {
        expect(quantizeProgress(32, "third")).toBe(0);
        expect(quantizeProgress(33, "third")).toBe(0);
        // * 1/3 step = 33.33…% — 34% crosses into bucket 33.
        expect(quantizeProgress(34, "third")).toBe(33);
        expect(quantizeProgress(40, "third")).toBe(33);
        // * 66% is BELOW 2/3 (66.67%) → still bucket 33. 67% crosses into bucket 66.
        expect(quantizeProgress(66, "third")).toBe(33);
        expect(quantizeProgress(67, "third")).toBe(66);
        expect(quantizeProgress(99.9, "third")).toBe(66);
        expect(quantizeProgress(100, "third")).toBe(100);
    });

    it("half floors into 50/100 buckets", () => {
        expect(quantizeProgress(49, "half")).toBe(0);
        expect(quantizeProgress(50, "half")).toBe(50);
        expect(quantizeProgress(99, "half")).toBe(50);
        expect(quantizeProgress(100, "half")).toBe(100);
    });
});

describe("bucketFactor (intensity curve, bug #5)", () => {
    it("100% bucket is always the exact full veil (factor 1) at every intensity", () => {
        expect(bucketFactor(100, "subtle")).toBe(1);
        expect(bucketFactor(100, "medium")).toBe(1);
        expect(bucketFactor(100, "strong")).toBe(1);
    });

    it("medium intensity raises the 25% bucket to half the veil (0.25^0.5 = 0.5)", () => {
        expect(bucketFactor(25, "medium")).toBeCloseTo(0.5, 10);
        expect(bucketFactor(50, "medium")).toBeCloseTo(Math.sqrt(0.5), 10);
    });

    it("strong intensity darkens low buckets earlier than medium", () => {
        // * 0.25^0.34 ≈ 0.624 — visibly stronger than medium's 0.5 at the same bucket.
        expect(bucketFactor(25, "strong")).toBeGreaterThan(bucketFactor(25, "medium"));
        expect(bucketFactor(25, "strong")).toBeCloseTo(0.6242, 3);
    });

    it("subtle intensity stays linear (bucket/100)", () => {
        expect(bucketFactor(25, "subtle")).toBeCloseTo(0.25, 10);
        expect(bucketFactor(75, "subtle")).toBeCloseTo(0.75, 10);
    });

    it("factor is monotonically increasing per bucket at every intensity", () => {
        for (const intensity of ["subtle", "medium", "strong"] as const) {
            let prev = 0;
            for (const bucket of [25, 50, 75, 100]) {
                const f = bucketFactor(bucket, intensity);
                expect(f).toBeGreaterThan(prev);
                prev = f;
            }
        }
    });
});

describe("dim-watched CSS output", () => {
    it("emits 2 marker-scoped rules when enabled (thumbnail grayscale+opacity, metadata opacity)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.hoverReveal = false;
        s.progressSteps = "off";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(2);
        // * Thumbnail host: grayscale + opacity, scoped to the full-veil marker (dimmed-100).
        expect(
            css.some(
                (r) =>
                    r.includes('[data-yt-tweaks-dim="dimmed-100"]') &&
                    r.includes(".ytThumbnailViewModelHost") &&
                    r.includes("grayscale(1)") &&
                    r.includes("opacity"),
            ),
        ).toBe(true);
        // * Metadata container: opacity, scoped to the full-veil marker.
        expect(
            css.some(
                (r) =>
                    r.includes('[data-yt-tweaks-dim="dimmed-100"]') &&
                    r.includes(".ytLockupViewModelMetadata") &&
                    r.includes("opacity"),
            ),
        ).toBe(true);
    });

    it("off + medium emits the exact preset endpoint opacities (0.4 / 0.3)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "off";
        s.brightness = "medium";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css.some((r) => r.includes("opacity: 0.4"))).toBe(true);
        expect(css.some((r) => r.includes("opacity: 0.3"))).toBe(true);
    });

    it("quarter emits 4 bucket rule pairs (25/50/75/100) with intensity-curved opacities", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.hoverReveal = false;
        s.progressSteps = "quarter";
        s.brightness = "medium";
        s.stepIntensity = "medium";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        // * 4 buckets × 2 rules (thumb + text), no hover.
        expect(css).toHaveLength(8);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-25"]'))).toBe(true);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-50"]'))).toBe(true);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-75"]'))).toBe(true);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-100"]'))).toBe(true);
        // * Bucket 25 at "medium" intensity (exp 0.5): factor = 0.25^0.5 = 0.5 → thumb opacity
        //   = 1 - 0.5 × (1 - 0.4) = 0.7 — visibly dimmed (bug #5: linear would give 0.85).
        const rule25 = css.find((r) => r.includes('[data-yt-tweaks-dim="dimmed-25"]') && r.includes("opacity"));
        expect(rule25).toContain("opacity: 0.7");
        // * Bucket 100 keeps the full preset endpoint (0.4) regardless of intensity.
        const rule100 = css.find(
            (r) => r.includes('[data-yt-tweaks-dim="dimmed-100"]') && r.includes(".ytThumbnailViewModelHost"),
        );
        expect(rule100).toContain("opacity: 0.4");
        // * Grayscale follows the same curve (0.25^0.5 = 0.5 → grayscale(0.5)).
        expect(rule25).toContain("grayscale(0.5)");
    });

    it("strong intensity darkens low buckets earlier (25% bucket: factor 0.25^0.34 ≈ 0.62)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "quarter";
        s.brightness = "medium";
        s.stepIntensity = "strong";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        // * factor 0.25^0.34 ≈ 0.6242 → thumb opacity = 1 - 0.6242 × 0.6 ≈ 0.6255 → 0.626.
        const rule25 = css.find((r) => r.includes('[data-yt-tweaks-dim="dimmed-25"]') && r.includes("opacity"));
        expect(rule25).toContain("opacity: 0.626");
    });

    it("emitted CSS values are rounded to 3 decimals (no float noise in rules)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "quarter";
        s.stepIntensity = "strong";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        for (const rule of css) {
            expect(rule).not.toMatch(/\d\.\d{4,}/);
        }
    });

    it("half emits 2 bucket rule pairs (50/100)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.hoverReveal = false;
        s.progressSteps = "half";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(4);
        expect(css.filter((r) => r.includes('[data-yt-tweaks-dim="dimmed-50"]'))).toHaveLength(2);
        expect(css.filter((r) => r.includes('[data-yt-tweaks-dim="dimmed-100"]'))).toHaveLength(2);
    });

    it("third emits 3 bucket rule pairs (33/66/100)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.hoverReveal = false;
        s.progressSteps = "third";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(6);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-33"]'))).toBe(true);
        expect(css.some((r) => r.includes('[data-yt-tweaks-dim="dimmed-66"]'))).toBe(true);
    });

    it("rules are scoped to dimmed markers (not global)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "quarter";
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        // * Every rule must include a dimmed marker scope — no unscoped selectors.
        expect(css.every((r) => r.includes('[data-yt-tweaks-dim="dimmed-'))).toBe(true);
    });

    it("emits no CSS when disabled", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = false;
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toEqual([]);
    });

    it("emits 2 rules per bucket (no hover) when hoverReveal is false", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "off";
        s.hoverReveal = false;
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(2);
        expect(css.every((r) => !r.includes(":hover"))).toBe(true);
    });

    it("emits 6 rules per bucket (2 base + 2 transition + 2 reveal) when hoverReveal is true", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "off";
        s.hoverReveal = true;
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(6);
        // * The 2 transition-delay base rules bridge the mini-player re-render flash (delayed fade-back).
        const delayRules = css.filter((r) => !r.includes(":hover") && r.includes("transition-delay"));
        expect(delayRules).toHaveLength(2);
        expect(delayRules.some((r) => r.includes("transition-delay: 400ms"))).toBe(true);
        // * The 2 reveal rules use :hover OR :has(.ytSpecTouchFeedbackShapeHovered) — instant enter.
        //   Each rule is a 2-selector comma list (both carry the full descendant chain).
        const revealRules = css.filter((r) => r.includes(":hover"));
        expect(revealRules).toHaveLength(2);
        expect(revealRules.some((r) => r.includes("filter: none") && r.includes("opacity: 1"))).toBe(true);
        expect(revealRules.some((r) => r.includes("opacity: 1") && r.includes(".ytLockupViewModelMetadata"))).toBe(
            true,
        );
        // * Reveal rules reset transition+delay to 0s (instant enter — base delay only affects leave).
        expect(revealRules.every((r) => r.includes("transition-delay: 0s"))).toBe(true);
        // * Reveal rules include the JS-driven hover class (catches mini-player overlay case).
        expect(revealRules.every((r) => r.includes("ytSpecTouchFeedbackShapeHovered"))).toBe(true);
        // * Each reveal rule has BOTH selectors carrying the descendant target — no orphan :hover.
        //   The :hover part must also include the thumbnail/metadata selector (not just the scope).
        for (const r of revealRules) {
            const selectors = r.slice(0, r.indexOf(" {")).split(", ");
            expect(selectors).toHaveLength(2);
            // * Both selectors must end with the same descendant target.
            expect(
                selectors[0].includes("ytThumbnailViewModelHost") || selectors[0].includes("ytLockupViewModelMetadata"),
            ).toBe(true);
            expect(
                selectors[1].includes("ytThumbnailViewModelHost") || selectors[1].includes("ytLockupViewModelMetadata"),
            ).toBe(true);
        }
    });

    it("reveal rules are scoped to dimmed markers (not global)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.dimWatched) as DimWatchedSettings;
        s.enabled = true;
        s.progressSteps = "quarter";
        s.hoverReveal = true;
        const css = dimWatchedFeature.pages.home!.css!(s, undefined as never);
        const revealRules = css.filter((r) => r.includes(":hover"));
        expect(revealRules.length).toBeGreaterThan(0);
        expect(revealRules.every((r) => r.includes('[data-yt-tweaks-dim="dimmed-'))).toBe(true);
    });
});
