// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { adsHideFeature } from "../features/ads-hide";
import { DEFAULT_SETTINGS, type AdsSettings } from "../settings";

/**
 * Fixture test for the member-only grid-item hide against a REAL user-reported YouTube DOM
 * (live lockup structure, captured 2026-10-24 from a home-feed item with the
 * "Nur für Kanalmitglieder" badge).
 *
 * Verifies:
 * 1. The emitted CSS rules target exactly the fixture's badge anchor (ytBadgeShapeCommerce)
 *    inside the grid wrapper (ytd-rich-item-renderer) — language-independent class match.
 * 2. The anchor is present exactly once and the promoted ("Von YouTube empfohlen") badge is
 *    NOT the anchor (no over-hide of promoted-only items).
 * 3. A watch-sidebar-shaped subtree (bare lockup inside ytd-watch-next-secondary-results-renderer)
 *    also carries the anchor the sidebar rule needs.
 *
 * * DOM-Fixture: __fixtures__/member-only-lockup.fixture.html (captured 2026-10-24, locale=de-DE,
 *   user-reported live DOM — the old member-only-badge fixture shows the dead
 *   badge-style-type-members-only class with probe-count 0 and is superseded).
 * ? jsdom's selector engine (nwsapi) cannot evaluate :has() — the rules are string-asserted and
 *   the :has()-anchored subtree relation is verified via the equivalent non-:has() selector.
 */

const GRID_RULE = `ytd-rich-item-renderer:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`;
const SIDEBAR_RULE = `ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`;

const ads = (): AdsSettings => structuredClone(DEFAULT_SETTINGS.ads) as AdsSettings;

// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("member-only-lockup"))("member-only lockup fixture", () => {
    it("the fixture carries the member-only badge anchor exactly once", () => {
        loadFixture("member-only-lockup");
        // * The anchor the CSS rules :has() matches on — inside the grid wrapper.
        expect(document.querySelectorAll("ytd-rich-item-renderer badge-shape.ytBadgeShapeCommerce").length).toBe(1);
        expect(document.querySelectorAll("badge-shape.ytBadgeShapeCommerce").length).toBe(1);
    });

    it("the promoted badge is NOT the anchor (no over-hide of promoted-only items)", () => {
        loadFixture("member-only-lockup");
        // * "Von YouTube empfohlen" uses ytBadgeShapePromoted — a DIFFERENT badge-shape class.
        expect(document.querySelectorAll("badge-shape.ytBadgeShapePromoted").length).toBe(1);
        expect(
            document.querySelector("badge-shape.ytBadgeShapeCommerce")!.classList.contains("ytBadgeShapePromoted"),
        ).toBe(false);
    });

    it("the fixture structure matches the rule wrappers (rich-item > #content > lockup)", () => {
        loadFixture("member-only-lockup");
        const item = document.querySelector("ytd-rich-item-renderer")!;
        expect(item.querySelector("#content yt-lockup-view-model")).not.toBeNull();
        // * The :has() subtree relation, verified without :has() (jsdom/nwsapi cannot evaluate it):
        // * badge inside the lockup inside the grid wrapper.
        expect(item.querySelector("yt-lockup-view-model badge-shape.ytBadgeShapeCommerce")).not.toBeNull();
    });

    it("adsCss emits the grid + sidebar rules for this fixture's anchor", () => {
        const a = ads();
        a.promo.enabled = true;
        a.promo.hideMemberOnly = true;
        const css = adsHideFeature.pages.home!.css!(a, undefined as never);
        expect(css).toContain(GRID_RULE);
        expect(css).toContain(SIDEBAR_RULE);
    });

    it("a watch-sidebar-shaped subtree carries the anchor the sidebar rule needs", () => {
        loadFixture("member-only-lockup");
        // * Move the fixture's lockup into a sidebar-shaped wrapper (bare lockup, no
        // * ytd-rich-item-renderer — mirrors watch-recommendations.fixture.html structure).
        const lockup = document.querySelector("yt-lockup-view-model")!;
        const sidebar = document.createElement("ytd-watch-next-secondary-results-renderer");
        const section = document.createElement("ytd-item-section-renderer");
        document.body.appendChild(sidebar);
        sidebar.appendChild(section);
        section.appendChild(lockup);
        // * Sidebar-rule anchor subtree (non-:has() equivalent of the rule selector).
        expect(
            document.querySelectorAll(
                "ytd-watch-next-secondary-results-renderer yt-lockup-view-model badge-shape.ytBadgeShapeCommerce",
            ).length,
        ).toBe(1);
    });
});
