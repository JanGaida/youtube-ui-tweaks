import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS } from "../settings";

/**
 * Tests for the video-item hardening migrations (ADR 0006):
 *
 * 1. styling free-form rem fields (titleFontSize/metaFontSize/metaPaddingTop + margins)
 *    → preset enums (titleSize/metaSize/metaSpacing).
 * 2. textShorten.viewsText free text → viewsWordMode enum ("none" | "locale").
 * 3. New keys (dimWatched.progressSteps, hideElements) default via deepMerge.
 *
 * Pure-logic (node env) — mocks GM_getValue to return a saved-settings JSON string,
 * then verifies loadSettings() maps the old shape onto the new one and removes
 * the old fields.
 */

// * Mock GM_getValue — loadSettings calls it with SETTINGS_KEY.
function mockGmGetValue(saved: unknown): void {
    vi.stubGlobal("GM_getValue", (_key: string, _default: string) => JSON.stringify(saved));
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

/** Writes the legacy styling shape (pre-hardening) into a saved-settings object. */
function legacyStyling(saved: Record<string, unknown>, titleFs: string, metaFs: string, padTop: string): void {
    const styling = saved.styling as Record<string, unknown>;
    styling.titleFontSize = titleFs;
    styling.titleLineHeight = "1.85rem";
    styling.metaFontSize = metaFs;
    styling.metaLineHeight = "1.15rem";
    styling.metaPaddingTop = padTop;
    styling.titleMarginLeft = "0rem";
    styling.titleMarginRight = "0rem";
    delete styling.titleSize;
    delete styling.metaSize;
    delete styling.metaSpacing;
}

describe("styling rem → preset migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("exact defaults → medium/medium/normal", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved, "1.35rem", "1.15rem", "0.65rem");
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.titleSize).toBe("medium");
        expect(result.styling.metaSize).toBe("medium");
        expect(result.styling.metaSpacing).toBe("normal");
    });

    it("custom rem → nearest preset (1.55rem title → large, 1.05rem meta → small, 0.9rem pad → relaxed)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved, "1.55rem", "1.05rem", "0.9rem");
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.titleSize).toBe("large");
        expect(result.styling.metaSize).toBe("small");
        expect(result.styling.metaSpacing).toBe("relaxed");
    });

    it("boundary values map to the closer preset (1.275rem → small, 1.2751 → medium)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved, "1.275rem", "1.15rem", "0.65rem");
        mockGmGetValue(saved);
        expect(loadSettings().styling.titleSize).toBe("small");

        const saved2 = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved2, "1.2751rem", "1.15rem", "0.65rem");
        mockGmGetValue(saved2);
        expect(loadSettings().styling.titleSize).toBe("medium");
    });

    it("malformed rem strings fall back to medium/normal (no NaN)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved, "garbage", "12px", "");
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.titleSize).toBe("medium");
        expect(result.styling.metaSize).toBe("medium");
        expect(result.styling.metaSpacing).toBe("normal");
    });

    it("removes all legacy keys (margins, font/line-height, padding)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        legacyStyling(saved, "1.35rem", "1.15rem", "0.65rem");
        mockGmGetValue(saved);

        const styling = loadSettings().styling as unknown as Record<string, unknown>;
        for (const k of [
            "titleFontSize",
            "titleLineHeight",
            "metaFontSize",
            "metaLineHeight",
            "metaPaddingTop",
            "titleMarginLeft",
            "titleMarginRight",
        ]) {
            expect(styling[k]).toBeUndefined();
        }
    });

    it("does not migrate when legacy keys are absent (already migrated)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const styling = saved.styling as Record<string, unknown>;
        styling.titleSize = "large";
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.titleSize).toBe("large");
    });
});

describe("textShorten.viewsText → viewsWordMode migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it('empty string → "none"', () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const textShorten = saved.textShorten as Record<string, unknown>;
        textShorten.viewsText = "";
        delete textShorten.viewsWordMode;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.textShorten.viewsWordMode).toBe("none");
        expect((result.textShorten as unknown as Record<string, unknown>).viewsText).toBeUndefined();
    });

    it('non-empty string → "locale" (word comes from LOCALE_PATTERNS now)', () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const textShorten = saved.textShorten as Record<string, unknown>;
        textShorten.viewsText = "Aufrufe";
        delete textShorten.viewsWordMode;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.textShorten.viewsWordMode).toBe("locale");
        expect((result.textShorten as unknown as Record<string, unknown>).viewsText).toBeUndefined();
    });

    it("keeps the saved viewsWordMode when viewsText is absent (already migrated)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const textShorten = saved.textShorten as Record<string, unknown>;
        textShorten.viewsWordMode = "locale";
        mockGmGetValue(saved);

        expect(loadSettings().textShorten.viewsWordMode).toBe("locale");
    });

    it("icons defaults via deepMerge when absent", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const textShorten = saved.textShorten as Record<string, unknown>;
        delete textShorten.icons;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.textShorten.icons).toEqual({ viewsIcon: true, dateIcon: true, sizeEm: 0.9 });
    });
});

describe("new keys default via deepMerge", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("dimWatched.progressSteps defaults to third when absent (curated default)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.dimWatched as Record<string, unknown>).progressSteps;
        mockGmGetValue(saved);

        expect(loadSettings().dimWatched.progressSteps).toBe("third");
    });

    it("dimWatched.stepIntensity defaults to medium when absent (bug #5 fix)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.dimWatched as Record<string, unknown>).stepIntensity;
        mockGmGetValue(saved);

        expect(loadSettings().dimWatched.stepIntensity).toBe("medium");
    });

    it("hideElements defaults when absent entirely", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete saved.hideElements;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.hideElements).toEqual({ enabled: true, hideVerifiedBadge: true });
    });

    it("saved hideElements values survive deepMerge", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        saved.hideElements = { enabled: true, hideVerifiedBadge: true };
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.hideElements.hideVerifiedBadge).toBe(true);
    });
});
