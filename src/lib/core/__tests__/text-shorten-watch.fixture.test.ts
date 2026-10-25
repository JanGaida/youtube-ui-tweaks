// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { shortenText } from "../text";
import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";

/**
 * Fixture test for text-shorten against a watch-page recommendation sidebar DOM.
 *
 * The watch page's right-hand recommendation list (ytd-watch-next-secondary-results-renderer)
 * reuses the same yt-lockup-view-model / .ytContentMetadataViewModelMetadataText structure as
 * home/subscriptions — BUT with two key differences:
 *
 * ~ DECISION-LOG: watch differs from home:
 *   1. Views span textContent = bare number ("270.417") — "Aufrufe" only in aria-label
 *      (home has "1032 Aufrufe" in textContent). Views regex must match number-only.
 *   2. Date span textContent = abbreviated ("vor 15 Std.") — full form ("vor 15 Stunden") only
 *      in aria-label (home uses full form). Date regex must match abbreviated "Std."/"Tg.".
 *
 * * DOM-Fixture: __fixtures__/watch-recommendations.fixture.html (captured 2026-08-10, locale=de)
 *   Selector .ytContentMetadataViewModelMetadataText → light DOM, 9 matches (per probe-counts).
 *   3 yt-lockup-view-models, each with views + date metadata rows.
 */
// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("watch-recommendations"))("text-shorten watch-recommendations fixture", () => {
    let settings: Settings;

    beforeEach(() => {
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.textShorten.shortenViews = true;
        settings.textShorten.shortenDate = true;
        settings.textShorten.dateFormats.hours = "h";
        settings.textShorten.dateFormats.days = "d";
    });

    it("fixture has metadata text nodes matching the probe-counts", () => {
        const { dom, meta } = loadFixture("watch-recommendations");
        const nodes = dom.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
        expect(meta.probeCounts[".ytContentMetadataViewModelMetadataText"].count).toBe(nodes.length);
        expect(nodes.length).toBeGreaterThan(0);
    });

    it("fixture has watch-next-secondary-results-renderer", () => {
        const { dom } = loadFixture("watch-recommendations");
        const el = dom.querySelector("ytd-watch-next-secondary-results-renderer");
        expect(el).not.toBeNull();
    });

    /**
     * Finds a metadata text node whose aria-label contains the given substring. On the watch
     * page, the full text ("270.417 Aufrufe") lives in aria-label while textContent is abbreviated
     * ("270.417"); we search by aria-label.
     */
    function findNodeByAriaLabel(dom: Document, needle: string): HTMLElement | undefined {
        const nodes = dom.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
        return Array.from(nodes).find((n) => n.getAttribute("aria-label")?.includes(needle));
    }

    it("shortens a views text node (270.417 → 270k)", () => {
        const { dom } = loadFixture("watch-recommendations");
        // * textContent = "270.417" (bare number, no "Aufrufe" word)
        const node = findNodeByAriaLabel(dom, "270.417 Aufrufe");
        expect(node, "fixture must contain a views node (aria-label '270.417 Aufrufe')").toBeDefined();
        shortenText(node!, settings, "de");
        expect(node!.textContent).toMatch(/k/);
        expect(node!.dataset.ytTweaked).toBe("1");
    });

    it("shortens a large views node (1,6 Mio. → 1.6M)", () => {
        const { dom } = loadFixture("watch-recommendations");
        const node = findNodeByAriaLabel(dom, "1,6 Millionen Aufrufe");
        expect(node, "fixture must contain a '1,6 Millionen' views node").toBeDefined();
        shortenText(node!, settings, "de");
        expect(node!.textContent).toMatch(/M/);
        expect(node!.textContent).not.toContain("Mio.");
    });

    it("shortens a small views node (4.742 → 4,7k)", () => {
        const { dom } = loadFixture("watch-recommendations");
        const node = findNodeByAriaLabel(dom, "4.742 Aufrufe");
        expect(node, "fixture must contain a '4.742 Aufrufe' node").toBeDefined();
        shortenText(node!, settings, "de");
        expect(node!.textContent).toMatch(/k/);
    });

    it("shortens an abbreviated date (vor 15 Std. → 15h)", () => {
        const { dom } = loadFixture("watch-recommendations");
        // * textContent = "vor 15 Std." (abbreviated); aria-label = "vor 15 Stunden" (full)
        const node = findNodeByAriaLabel(dom, "vor 15 Stunden");
        expect(node, "fixture must contain an hours date node").toBeDefined();
        shortenText(node!, settings, "de");
        expect(node!.textContent).toMatch(/15h/);
    });
});
