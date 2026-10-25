// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { runAll, resetRegistry } from "../registry";
import { registerAllFeatures } from "../features";

/**
 * Fixture test for guide-entries against a REAL captured YouTube guide-full DOM.
 *
 * Verifies:
 * 1. Entry selectors match the expected probe-counts (29 ytd-guide-entry-renderer).
 * 2. Known entries are detected from the fixture DOM (home, shorts, subscriptions, etc.).
 * 3. Expand/collapse entries are present and excluded.
 * 4. Hide works (display:none on hidden entries).
 * 5. Reorder works (DOM-Move changes entry order within a parent).
 *
 * * DOM-Fixture: __fixtures__/guide-full.fixture.html (captured 2026-08-22, locale=de-DE).
 *   Mini-Guide: 0 entries, disable-upgrade, hidden — not testable.
 * ~ DECISION-LOG: entry detection via 4 strategies (path/hostname/title/parent-section) verified
 *   against real fixture DOM. Shorts has no href (title-match), myVideos is external (hostname-match).
 */

function makeCtx(settings: Settings): { page: "home"; locale: string; settings: Settings } {
    return { page: "home", locale: "de", settings };
}

// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("guide-full"))("guide-entries fixture (guide-full.fixture.html)", () => {
    let settings: Settings;

    beforeEach(() => {
        resetRegistry();
        registerAllFeatures();
        loadFixture("guide-full");
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.guide.enabled = true;
    });

    afterEach(() => {
        resetRegistry();
    });

    it("fixture contains ytd-guide-entry-renderer elements (two guide-renderer roots captured)", () => {
        const entries = document.querySelectorAll("ytd-guide-entry-renderer");
        // * Fixture captures both #guide (tp-yt-app-drawer) + standalone ytd-guide-renderer.
        //   Probe-counts said 29 (live page has one visible guide), but fixture HTML has both roots.
        expect(entries.length).toBe(58);
    });

    it("fixture contains a.yt-simple-endpoint links", () => {
        const links = document.querySelectorAll("ytd-guide-entry-renderer a.yt-simple-endpoint");
        expect(links.length).toBeGreaterThan(0);
    });

    it("fixture contains ytd-guide-section-renderer sections", () => {
        const sections = document.querySelectorAll("ytd-guide-section-renderer");
        expect(sections.length).toBeGreaterThan(0);
    });

    it("detects known entries from the fixture DOM", () => {
        const homeLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/"]',
        );
        expect(homeLink).toBeTruthy();
        expect(homeLink?.getAttribute("title")).toBe("Startseite");

        const subsLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/feed/subscriptions"]',
        );
        expect(subsLink).toBeTruthy();

        const historyLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/feed/history"]',
        );
        expect(historyLink).toBeTruthy();

        const watchLaterLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/playlist?list=WL"]',
        );
        expect(watchLaterLink).toBeTruthy();

        const downloadsLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/feed/downloads"]',
        );
        expect(downloadsLink).toBeTruthy();

        // * Shorts has NO href — only title attribute.
        const shortsLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[title="Shorts"]',
        );
        expect(shortsLink).toBeTruthy();
        expect(shortsLink?.getAttribute("href")).toBeNull();

        // * myVideos is external (studio.youtube.com).
        const myVideosLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href^="https://studio.youtube.com"]',
        );
        expect(myVideosLink).toBeTruthy();

        // * ytMusic is external (music.youtube.com).
        const ytMusicLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href^="https://music.youtube.com"]',
        );
        expect(ytMusicLink).toBeTruthy();
    });

    it("expand/collapse entries are present with role=button or expander/collapser ids", () => {
        const expander = document.querySelector("ytd-guide-entry-renderer#expander-item");
        expect(expander).toBeTruthy();

        const collapser = document.querySelector("ytd-guide-entry-renderer#collapser-item");
        expect(collapser).toBeTruthy();

        const roleButtons = document.querySelectorAll('ytd-guide-entry-renderer[role="button"]');
        expect(roleButtons.length).toBeGreaterThan(0);
    });

    it("showMore: showMoreButton=false hides all 'Mehr/Weniger anzeigen' expanders", () => {
        settings.guide.showMoreButton = false;
        runAll(makeCtx(settings));

        const expanders = document.querySelectorAll<HTMLElement>("ytd-guide-collapsible-entry-renderer");
        expect(expanders.length).toBeGreaterThan(0);
        for (const exp of expanders) {
            const a = exp.querySelector<HTMLElement>("a");
            if (!a) continue;
            const title = a.getAttribute("title");
            if (title === "Mehr anzeigen" || title === "Weniger anzeigen") {
                expect(exp.style.display).toBe("none");
                expect(exp.hasAttribute("data-yt-tweaks-guide-more-hidden")).toBe(true);
            }
        }
    });

    it("showMore: showMoreDefault=true clicks all 'Mehr anzeigen' expanders (marks expanded)", () => {
        settings.guide.showMoreDefault = true;
        runAll(makeCtx(settings));

        // * All "Mehr anzeigen" anchors must carry the expanded marker + be clicked.
        const moreLinks = document.querySelectorAll<HTMLElement>(
            'ytd-guide-collapsible-entry-renderer a[title="Mehr anzeigen"]',
        );
        // * Fixture contains both guide roots → multiple expanders.
        expect(moreLinks.length).toBeGreaterThan(0);
        for (const a of moreLinks) {
            expect(a.hasAttribute("data-yt-tweaks-guide-expanded")).toBe(true);
        }
    });

    it("showMore: showMoreButton=false + showMoreDefault=true expands then hides button (bug: expanded+hidden)", () => {
        // * Bug: both flags active → expanded AND button hidden.
        //   Previously this was exclusive via else-if → expanded never got through (collapsed + no button).
        settings.guide.showMoreButton = false;
        settings.guide.showMoreDefault = true;
        runAll(makeCtx(settings));

        // * Expander buttons must be hidden (both title variants).
        const expanders = document.querySelectorAll<HTMLElement>("ytd-guide-collapsible-entry-renderer");
        let hiddenCount = 0;
        for (const exp of expanders) {
            const a = exp.querySelector<HTMLElement>("a");
            if (!a) continue;
            const title = a.getAttribute("title");
            if (title === "Mehr anzeigen" || title === "Weniger anzeigen") {
                expect(exp.style.display).toBe("none");
                expect(exp.hasAttribute("data-yt-tweaks-guide-more-hidden")).toBe(true);
                hiddenCount++;
            }
        }
        expect(hiddenCount).toBeGreaterThan(0);
    });

    it("hide entries: setting guide.entries.hidden.home=true hides the home entry", () => {
        settings.guide.entries.hidden = { home: true };
        runAll(makeCtx(settings));

        const homeEntry = document
            .querySelector<HTMLAnchorElement>('ytd-guide-entry-renderer a.yt-simple-endpoint[href="/"]')
            ?.closest("ytd-guide-entry-renderer") as HTMLElement | null;
        expect(homeEntry).toBeTruthy();
        expect(homeEntry?.style.display).toBe("none");
        expect(homeEntry?.hasAttribute("data-yt-tweaks-guide-hidden")).toBe(true);
    });

    it("hide entries: multiple hidden hides all matching entries", () => {
        settings.guide.entries.hidden = { home: true, history: true, downloads: true };
        runAll(makeCtx(settings));

        const homeEntry = document
            .querySelector<HTMLAnchorElement>('ytd-guide-entry-renderer a.yt-simple-endpoint[href="/"]')
            ?.closest("ytd-guide-entry-renderer") as HTMLElement | null;
        expect(homeEntry?.style.display).toBe("none");

        const historyEntry = document
            .querySelector<HTMLAnchorElement>('ytd-guide-entry-renderer a.yt-simple-endpoint[href="/feed/history"]')
            ?.closest("ytd-guide-entry-renderer") as HTMLElement | null;
        expect(historyEntry?.style.display).toBe("none");

        const downloadsEntry = document
            .querySelector<HTMLAnchorElement>('ytd-guide-entry-renderer a.yt-simple-endpoint[href="/feed/downloads"]')
            ?.closest("ytd-guide-entry-renderer") as HTMLElement | null;
        expect(downloadsEntry?.style.display).toBe("none");
    });

    it("reorder: setting guide.entries.order moves entries within their parent", () => {
        const firstSection = document.querySelector("ytd-guide-section-renderer #items");
        expect(firstSection).toBeTruthy();

        const entriesBefore = firstSection!.querySelectorAll("ytd-guide-entry-renderer");
        const firstTitle = entriesBefore[0]?.querySelector("a")?.getAttribute("title");
        const secondTitle = entriesBefore[1]?.querySelector("a")?.getAttribute("title");
        expect(firstTitle).toBe("Startseite");
        expect(secondTitle).toBe("Shorts");

        // * Reorder: put shorts before home.
        settings.guide.entries.order = ["shorts", "home"];
        runAll(makeCtx(settings));

        const entriesAfter = firstSection!.querySelectorAll("ytd-guide-entry-renderer");
        const newFirstTitle = entriesAfter[0]?.querySelector("a")?.getAttribute("title");
        const newSecondTitle = entriesAfter[1]?.querySelector("a")?.getAttribute("title");
        expect(newFirstTitle).toBe("Shorts");
        expect(newSecondTitle).toBe("Startseite");
    });

    it("reorder: entries within 'Mein YouTube' collapsible section reorder (downloads before history)", () => {
        // * Bug 2: 'Mein YouTube' is a ytd-guide-collapsible-section-entry-renderer
        //   with sub-entries in #section-items. Downloads additionally sits inside a
        //   ytd-guide-downloads-entry-renderer wrapper. Reorder groups by
        //   parentElement → wrapper-isolated entries get no new position.
        //   Expectation: reorder applies to the entire 'Mein YouTube' group (flat).
        // * Navigate from the header link (/feed/you, title="Mein YouTube") to the section.
        const headerLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer#header-entry a.yt-simple-endpoint[href="/feed/you"]',
        );
        expect(headerLink).toBeTruthy();
        const collapsible = headerLink!.closest("ytd-guide-collapsible-section-entry-renderer") as HTMLElement;
        const sectionItems = collapsible.querySelector<HTMLElement>('[id="section-items"]');
        expect(sectionItems).toBeTruthy();

        const titlesBefore = Array.from(
            sectionItems!.querySelectorAll('ytd-guide-entry-renderer a[id="endpoint"]'),
        ).map((a) => a.getAttribute("title"));
        expect(titlesBefore).toContain("Verlauf");
        expect(titlesBefore).toContain("Downloads");
        const verlaufIdxBefore = titlesBefore.indexOf("Verlauf");
        const downloadsIdxBefore = titlesBefore.indexOf("Downloads");
        expect(verlaufIdxBefore).toBeLessThan(downloadsIdxBefore);

        // * Reorder: downloads before history.
        settings.guide.entries.order = ["downloads", "history"];
        runAll(makeCtx(settings));

        const titlesAfter = Array.from(sectionItems!.querySelectorAll('ytd-guide-entry-renderer a[id="endpoint"]')).map(
            (a) => a.getAttribute("title"),
        );
        const verlaufIdxAfter = titlesAfter.indexOf("Verlauf");
        const downloadsIdxAfter = titlesAfter.indexOf("Downloads");
        expect(downloadsIdxAfter).toBeLessThan(verlaufIdxAfter);
    });

    it("reorder: 'Entdecken' live before music — non-tracked 'Mehr anzeigen' expander stays in place", () => {
        // * Bug 2 (Entdecken): the 'Mehr anzeigen' expander (ytd-guide-collapsible-entry-renderer)
        //   is a non-tracked direct child of #items. appendChild of the tracked entries
        //   to the end placed them BEHIND the expander → the expander moved to the front.
        //   Expectation: tracked entries get sorted, expander stays at its position (end).
        const musicLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[title="Musik"]',
        );
        const discoverSection = musicLink!.closest("ytd-guide-section-renderer") as HTMLElement;
        const items = discoverSection.querySelector<HTMLElement>('[id="items"]');
        expect(items).toBeTruthy();

        const titlesBefore = Array.from(items!.querySelectorAll('ytd-guide-entry-renderer a[id="endpoint"]')).map((a) =>
            a.getAttribute("title"),
        );
        // * Only tracked entries (expander is role=button → excluded from collectEntries,
        //   but querySelectorAll finds all). Here: Musik, Filme & Shows, Live.
        expect(titlesBefore).toContain("Musik");
        expect(titlesBefore).toContain("Live");
        const musicIdxBefore = titlesBefore.indexOf("Musik");
        const liveIdxBefore = titlesBefore.indexOf("Live");
        expect(musicIdxBefore).toBeLessThan(liveIdxBefore);

        // * The expander wrapper must be the last direct child before the reorder.
        const directChildrenBefore = Array.from(items!.children).map((c) => c.tagName.toLowerCase());
        expect(directChildrenBefore[directChildrenBefore.length - 1]).toBe("ytd-guide-collapsible-entry-renderer");

        // * Reorder: live before music.
        settings.guide.entries.order = ["live", "music"];
        runAll(makeCtx(settings));

        const titlesAfter = Array.from(items!.querySelectorAll('ytd-guide-entry-renderer a[id="endpoint"]')).map((a) =>
            a.getAttribute("title"),
        );
        const musicIdxAfter = titlesAfter.indexOf("Musik");
        const liveIdxAfter = titlesAfter.indexOf("Live");
        expect(liveIdxAfter).toBeLessThan(musicIdxAfter);

        // * Expander wrapper stays the last direct child (not moved to the front).
        const directChildrenAfter = Array.from(items!.children).map((c) => c.tagName.toLowerCase());
        expect(directChildrenAfter[directChildrenAfter.length - 1]).toBe("ytd-guide-collapsible-entry-renderer");
    });

    it("disabled guide: no entries are hidden", () => {
        settings.guide.enabled = false;
        settings.guide.entries.hidden = { home: true };
        runAll(makeCtx(settings));

        const homeEntry = document
            .querySelector<HTMLAnchorElement>('ytd-guide-entry-renderer a.yt-simple-endpoint[href="/"]')
            ?.closest("ytd-guide-entry-renderer") as HTMLElement | null;
        expect(homeEntry?.style.display).not.toBe("none");
    });

    it("section-hide: hiding all entries of a section hides the section (incl. title)", () => {
        // * The "Mehr von YouTube" section contains ytPremium + ytMusic + ytKids (3 tracked entries).
        //   Hide all three → section must get display:none.
        settings.guide.entries.hidden = { ytPremium: true, ytMusic: true, ytKids: true };
        runAll(makeCtx(settings));

        // * Find the section that contains ytPremium (more robust than a title-text match).
        const premiumLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/premium"]',
        );
        const mehrSection = premiumLink?.closest("ytd-guide-section-renderer") as HTMLElement | undefined;
        expect(mehrSection).toBeTruthy();
        expect(mehrSection?.style.display).toBe("none");
        expect(mehrSection?.hasAttribute("data-yt-tweaks-guide-section-hidden")).toBe(true);
    });

    it("section-hide: partial hide keeps section visible (unhidden entries remain)", () => {
        // * Hide only ytPremium → ytMusic/ytKids still visible → section stays.
        settings.guide.entries.hidden = { ytPremium: true };
        runAll(makeCtx(settings));

        const premiumLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/premium"]',
        );
        const mehrSection = premiumLink?.closest("ytd-guide-section-renderer") as HTMLElement | undefined;
        expect(mehrSection).toBeTruthy();
        expect(mehrSection?.style.display).not.toBe("none");
    });

    it("group-hide: setting groups.hidden.moreFromYT hides the 'Mehr von YouTube' section", () => {
        settings.guide.entries.groups = {
            hidden: { moreFromYT: true },
            order: [],
        };
        runAll(makeCtx(settings));

        const premiumLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/premium"]',
        );
        const mehrSection = premiumLink?.closest("ytd-guide-section-renderer") as HTMLElement | undefined;
        expect(mehrSection).toBeTruthy();
        expect(mehrSection?.style.display).toBe("none");
    });

    it("group-hide: hiding 'main' group hides the home/shorts section", () => {
        settings.guide.entries.groups = {
            hidden: { main: true },
            order: [],
        };
        runAll(makeCtx(settings));

        const homeLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[href="/"]',
        );
        const mainSection = homeLink?.closest("ytd-guide-section-renderer") as HTMLElement | undefined;
        expect(mainSection).toBeTruthy();
        expect(mainSection?.style.display).toBe("none");
    });

    it("group-hide: unhidden group stays visible", () => {
        settings.guide.entries.groups = {
            hidden: { moreFromYT: true },
            order: [],
        };
        runAll(makeCtx(settings));

        // * 'discover' (Entdecken) group should stay visible.
        const musicLink = document.querySelector<HTMLAnchorElement>(
            'ytd-guide-entry-renderer a.yt-simple-endpoint[title="Musik"]',
        );
        const discoverSection = musicLink?.closest("ytd-guide-section-renderer") as HTMLElement | undefined;
        expect(discoverSection).toBeTruthy();
        expect(discoverSection?.style.display).not.toBe("none");
    });
});
