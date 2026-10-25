import { describe, it, expect } from "vitest";
import { adsHideFeature } from "../features/ads-hide";
import { DEFAULT_SETTINGS, type AdsSettings } from "../settings";

/**
 * Pure-logic tests for the ads-hide feature's CSS emission (adsCss).
 *
 * Validates the group gates (promo/shelves/survey `enabled` + individual `hide*` toggles) and
 * the exact selector rules — especially the Playables shelf rule
 * (`ytd-mini-game-card-view-model`), the gaming shelves rule (`ytd-game-card-renderer`), and
 * the dynamic gaming shelves rule (`has-rounded-box-art-thumbnail-style`).
 */

describe("ads-hide adsCss", () => {
    const shelves = (): AdsSettings => structuredClone(DEFAULT_SETTINGS.ads) as AdsSettings;

    it("emits the playables shelf rule when hidePlayablesShelf is on", () => {
        const a = shelves();
        a.shelves.enabled = true;
        a.shelves.hidePlayablesShelf = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        const rule = css.find((r) => r.includes("ytd-mini-game-card-view-model"));
        expect(rule).toBe("ytd-rich-section-renderer:has(ytd-mini-game-card-view-model) { display: none !important; }");
    });

    it("does not emit the playables shelf rule when hidePlayablesShelf is off", () => {
        const a = shelves();
        a.shelves.enabled = true;
        a.shelves.hidePlayablesShelf = false;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytd-mini-game-card-view-model"))).toBeUndefined();
    });

    it("does not emit shelf rules when the shelves group is disabled", () => {
        const a = shelves();
        a.shelves.enabled = false;
        a.shelves.hidePlayablesShelf = true;
        a.shelves.hideGameShelves = true;
        a.shelves.hideDynamicGameShelves = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytd-mini-game-card-view-model"))).toBeUndefined();
        expect(css.find((r) => r.includes("ytd-game-card-renderer"))).toBeUndefined();
        expect(css.find((r) => r.includes("has-rounded-box-art-thumbnail-style"))).toBeUndefined();
    });

    it("emits game + dynamic game shelf rules independently of the playables rule", () => {
        const a = shelves();
        a.shelves.enabled = true;
        a.shelves.hideGameShelves = true;
        a.shelves.hideDynamicGameShelves = true;
        // * Curated default ships hidePlayablesShelf=true — opt out explicitly to prove
        //   the game rules fire independently of the playables rule.
        a.shelves.hidePlayablesShelf = false;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytd-game-card-renderer"))).toBeDefined();
        expect(css.find((r) => r.includes("has-rounded-box-art-thumbnail-style"))).toBeDefined();
        expect(css.find((r) => r.includes("ytd-mini-game-card-view-model"))).toBeUndefined();
    });

    it("defaults hide the playables shelf (curated default)", () => {
        const a = shelves();
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytd-mini-game-card-view-model"))).toBeDefined();
    });

    it("lists the playables toggle in liveApplyKeys", () => {
        expect(adsHideFeature.liveApplyKeys).toContain("ads.shelves.hidePlayablesShelf");
    });

    it("emits the continue-watching shelf rule when hideContinueWatchingShelf is on", () => {
        const a = shelves();
        a.shelves.enabled = true;
        a.shelves.hideContinueWatchingShelf = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        const rule = css.find((r) => r.includes('[href*="&t="]'));
        expect(rule).toBe(
            `ytd-rich-section-renderer:has(ytd-rich-shelf-renderer a[href*="&t="]) { display: none !important; }`,
        );
    });

    it("does not emit the continue-watching shelf rule when hideContinueWatchingShelf is off", () => {
        const a = shelves();
        a.shelves.enabled = true;
        // * Curated default ships hideContinueWatchingShelf=true — opt out explicitly.
        a.shelves.hideContinueWatchingShelf = false;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes('[href*="&t="]'))).toBeUndefined();
    });

    it("does not emit the continue-watching rule when the shelves group is disabled", () => {
        const a = shelves();
        a.shelves.enabled = false;
        a.shelves.hideContinueWatchingShelf = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes('[href*="&t="]'))).toBeUndefined();
    });

    it("lists the continue-watching toggle in liveApplyKeys", () => {
        expect(adsHideFeature.liveApplyKeys).toContain("ads.shelves.hideContinueWatchingShelf");
    });
});

describe("ads-hide member-only (hideMemberOnly)", () => {
    const ads = (): AdsSettings => structuredClone(DEFAULT_SETTINGS.ads) as AdsSettings;

    const GRID_RULE = `ytd-rich-item-renderer:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`;
    const SIDEBAR_RULE = `ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`;

    it("emits the grid + watch-sidebar rules when promo group + hideMemberOnly are on", () => {
        const a = ads();
        a.promo.enabled = true;
        a.promo.hideMemberOnly = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css).toContain(GRID_RULE);
        expect(css).toContain(SIDEBAR_RULE);
    });

    it("does not emit member-only rules when hideMemberOnly is off", () => {
        const a = ads();
        a.promo.enabled = true;
        a.promo.hideMemberOnly = false;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytBadgeShapeCommerce"))).toBeUndefined();
    });

    it("does not emit member-only rules when the promo group is disabled", () => {
        const a = ads();
        a.promo.enabled = false;
        a.promo.hideMemberOnly = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css.find((r) => r.includes("ytBadgeShapeCommerce"))).toBeUndefined();
    });

    it("defaults hide member-only grid items (hideMemberOnly true)", () => {
        const a = ads();
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css).toContain(GRID_RULE);
        expect(css).toContain(SIDEBAR_RULE);
    });

    it("lists the member-only toggle in liveApplyKeys", () => {
        expect(adsHideFeature.liveApplyKeys).toContain("ads.promo.hideMemberOnly");
    });
});
