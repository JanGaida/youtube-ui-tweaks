// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { shortenText } from "../text";
import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";

/**
 * Fixture test for text-shorten against a REAL captured YouTube home-grid DOM.
 *
 * The fixture holds ORIGINAL YouTube text (captured with tweaks inactive — no
 * `data-yt-tweaked` markers). Tests select nodes by their original text and run the
 * real `shortenText` transform on them.
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (captured 2026-08-09, locale=de)
 *   Selector .ytContentMetadataViewModelMetadataText → light DOM, 69 matches (per probe-counts).
 *   Shadow-DOM boundary: ytd-rich-item-renderer internals (not needed — metadata is light DOM).
 */
// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("home-grid-item"))("text-shorten fixture", () => {
    let settings: Settings;

    beforeEach(() => {
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.textShorten.shortenViews = true;
        settings.textShorten.shortenDate = true;
        settings.textShorten.dateFormats.years = "Y";
    });

    it("fixture has metadata text nodes matching the probe-counts", () => {
        const { dom, meta } = loadFixture("home-grid-item");
        const nodes = dom.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
        expect(meta.probeCounts[".ytContentMetadataViewModelMetadataText"].count).toBe(nodes.length);
        expect(nodes.length).toBeGreaterThan(0);
    });

    it("fixture has grid items matching the probe-counts", () => {
        const { dom, meta } = loadFixture("home-grid-item");
        const items = dom.querySelectorAll<HTMLElement>(".ytLockupMetadataViewModelStandard");
        expect(meta.probeCounts[".ytLockupMetadataViewModelStandard"].count).toBe(items.length);
    });

    it("shortens a views text node (X Aufrufe → Xk)", () => {
        const { dom } = loadFixture("home-grid-item");
        // * bug: findMetadataNode takes the FIRST 'Aufrufe' node — in this fixture that is a
        //   Mio-scale node ("X Mio. Aufrufe" → "X.XM"), not a k-scale one. Select a plain-number
        //   node (>= 4 digits, no unit) so the k-suffix assertion is actually testing k-scale.
        const nodes = dom.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
        const viewsNode = Array.from(nodes).find((n) => /^\d{4}[\d.,]*\s*Aufrufe$/.test(n.textContent?.trim() ?? ""));
        expect(viewsNode, "fixture must contain a plain-number views node (e.g. '450.552 Aufrufe')").toBeDefined();
        shortenText(viewsNode!, settings, "de");
        expect(viewsNode!.textContent).toMatch(/k$/);
        expect(viewsNode!.dataset.ytTweaked).toBe("1");
    });

    it("shortens a date text node (vor X Jahren → Y)", () => {
        const { dom } = loadFixture("home-grid-item");
        // * Search by REGEX, not by a "vor" substring: the first "vor"-containing node in
        //   this fixture is a days/hours date ("vor 6 Tagen"), not a years one — a substring
        //   search made this test return early vacuously for its entire life. Fail loudly
        //   when no years node exists (e.g. after a recapture).
        const nodes = dom.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
        const dateNode = Array.from(nodes).find((n) => /vor \d+ Jahren?/.test(n.textContent ?? ""));
        expect(dateNode, "fixture must contain a 'vor X Jahren' node").toBeDefined();
        shortenText(dateNode!, settings, "de");
        expect(dateNode!.textContent).toMatch(/Y$/);
    });
});
