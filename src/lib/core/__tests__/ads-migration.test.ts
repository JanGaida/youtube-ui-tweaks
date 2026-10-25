import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from "../settings";

/**
 * Tests for the flat `ads.{hideX}` → nested `ads.{promo|shelves|survey}.{enabled,hideX}` migration
 * in loadSettings().
 *
 * Pure-logic (node env) — mocks GM_getValue. The migration detects the old flat shape (booleans
 * directly under `ads`, no group sub-objects) and maps them into the three groups, each with
 * `enabled: true` (preserving the pre-migration behavior: group on, individual flags decide).
 *
 * * Already-nested saved ads (post-migration installs) are left untouched.
 * * Default hide-flags apply for any old flag that was absent (deep-merge fills the gaps).
 */

// * GM_getValue mock — keyed by GM-key name.
function mockGmGetValue(saved: unknown): void {
    vi.stubGlobal("GM_getValue", (key: string, def: string) => {
        if (key === SETTINGS_KEY) return JSON.stringify(saved);
        if (key === "ytTweaksEnabled") return "true";
        return def;
    });
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

describe("ads flat → nested migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("migrates flat ads flags into the matching groups with enabled:true", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * Simulate pre-migration flat ads: override some flags, leave others absent.
        (saved as Record<string, unknown>).ads = {
            hidePremiumBanner: false,
            hideBigScreenAds: true,
            hideMemberOnly: false,
            hideDiscoverSection: true,
            hideShortsShelf: true,
            hideGameShelves: false,
            hideDynamicGameShelves: true,
            hidePlayablesShelf: true,
            hideContinueWatchingShelf: true,
            hideInlineSurvey: false,
        };
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.ads.promo).toEqual({
            enabled: true,
            hidePremiumBanner: false,
            hideBigScreenAds: true,
            hideMemberOnly: false,
        });
        expect(result.ads.shelves).toEqual({
            enabled: true,
            hideDiscoverSection: true,
            hideShortsShelf: true,
            hideGameShelves: false,
            hideDynamicGameShelves: true,
            hidePlayablesShelf: true,
            hideContinueWatchingShelf: true,
        });
        expect(result.ads.survey).toEqual({
            enabled: true,
            hideInlineSurvey: false,
        });
    });

    it("applies default hide-flags for absent flat ads fields", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * Only one flat flag present — the rest fall back to defaults via deep-merge.
        (saved as Record<string, unknown>).ads = { hideShortsShelf: true };
        mockGmGetValue(saved);

        const result = loadSettings();
        // * hideShortsShelf migrated; other flags retain defaults.
        expect(result.ads.shelves.hideShortsShelf).toBe(true);
        expect(result.ads.shelves.hideDiscoverSection).toBe(false);
        expect(result.ads.shelves.hidePlayablesShelf).toBe(false);
        expect(result.ads.shelves.hideContinueWatchingShelf).toBe(false);
        expect(result.ads.promo.hidePremiumBanner).toBe(true);
        expect(result.ads.survey.hideInlineSurvey).toBe(true);
        // * All groups enabled (migration default).
        expect(result.ads.promo.enabled).toBe(true);
        expect(result.ads.shelves.enabled).toBe(true);
        expect(result.ads.survey.enabled).toBe(true);
    });

    it("does NOT overwrite already-nested ads", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * Post-migration nested shape — must not be touched by the migration.
        (saved as Record<string, unknown>).ads = {
            promo: { enabled: false, hidePremiumBanner: true, hideBigScreenAds: false, hideMemberOnly: true },
            shelves: {
                enabled: true,
                hideDiscoverSection: false,
                hideShortsShelf: true,
                hideGameShelves: false,
                hideDynamicGameShelves: false,
                hidePlayablesShelf: false,
            },
            survey: { enabled: false, hideInlineSurvey: true },
        };
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.ads.promo.enabled).toBe(false);
        expect(result.ads.survey.enabled).toBe(false);
        expect(result.ads.shelves.hideShortsShelf).toBe(true);
    });

    it("leaves an empty ads object as defaults (no flat flags)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        (saved as Record<string, unknown>).ads = {};
        mockGmGetValue(saved);

        const result = loadSettings();
        // * No flat flags → no migration → deep-merge fills nested defaults.
        expect(result.ads.promo.enabled).toBe(true);
        expect(result.ads.promo.hidePremiumBanner).toBe(true);
        expect(result.ads.survey.hideInlineSurvey).toBe(true);
    });
});
