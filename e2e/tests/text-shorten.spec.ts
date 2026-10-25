import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectGmPolyfill, injectUserscriptAfterLoad } from "../helpers/userscript";

/**
 * Text-shorten E2E — verifies view-count + date shortening runs against the captured grid.
 *
 * The injected userscript processes the fixture at boot (shortenText sets
 * `data-yt-tweaked-original` + the shortened text on matched nodes at RUNTIME — the
 * fixture file itself holds original YouTube text). To prove the transform re-runs in
 * a real browser, this test resets a node's markers, restores its original text, then
 * waits for the MutationObserver's THROTTLED re-run and asserts the node is re-shortened.
 *
 * ! Mirrors `src/lib/core/__tests__/text-shorten.fixture.test.ts` but in Firefox (real
 *   MutationObserver, real getComputedStyle) rather than jsdom.
 */

const FIXTURE = "/home-grid-item.fixture.html";
const META_SELECTOR = ".ytContentMetadataViewModelMetadataText";

test.describe("text-shorten", () => {
    test("a views text node is shortened (Aufrufe → k suffix)", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Reset one views node (restore original text + clear markers) so the observer re-runs
        //   shortenText on it. Returns the original text for context.
        const result = await page.evaluate((sel) => {
            const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
            const viewsNode = nodes.find((n) => n.dataset.ytTweakedOriginal?.includes("Aufrufe"));
            if (!viewsNode) return { found: false } as const;
            const original = viewsNode.dataset.ytTweakedOriginal!;
            viewsNode.textContent = original;
            delete viewsNode.dataset.ytTweakedOriginal;
            delete viewsNode.dataset.ytTweaked;
            return { found: true as const, original };
        }, META_SELECTOR);
        expect(result.found, "fixture must contain a views node (Aufrufe)").toBe(true);

        // * Wait for the MutationObserver's throttled re-run (observer on documentElement when
        //   no #content exists — see observer.ts). 1500ms covers the 200ms throttle + idle lag.
        await page.waitForTimeout(1500);

        // * The node should now be re-shortened: data-yt-tweaked="1" and text ending with "k".
        const shortened = await page.evaluate((sel) => {
            const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
            const viewsNode = nodes.find((n) => n.dataset.ytTweakedOriginal?.includes("Aufrufe"));
            if (!viewsNode) return { found: false } as const;
            return {
                found: true as const,
                text: viewsNode.textContent ?? "",
                tweaked: viewsNode.dataset.ytTweaked,
            };
        }, META_SELECTOR);

        expect(shortened.found).toBe(true);
        expect(shortened.tweaked).toBe("1");
        expect(shortened.text).toMatch(/k$/);
    });

    test("viewsWordMode=locale appends the de word (Aufrufe)", async ({ page }) => {
        // * Seed viewsWordMode=locale BEFORE boot, then verify shortened views texts carry the
        //   locale word (de "Aufrufe") — the ADR 0006 replacement for the viewsText free-form field.
        await injectGmPolyfill(page);
        await page.goto(FIXTURE);
        await page.evaluate(() => {
            const w = window as any;
            w.GM_setValue("ytTweaksSettings", JSON.stringify({ textShorten: { viewsWordMode: "locale" } }));
        });
        await injectUserscriptAfterLoad(page, false);

        // * Reset one views node so the observer re-runs shortenText with the seeded setting.
        const result = await page.evaluate((sel) => {
            const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
            const viewsNode = nodes.find((n) => n.dataset.ytTweakedOriginal?.includes("Aufrufe"));
            if (!viewsNode) return { found: false } as const;
            viewsNode.textContent = viewsNode.dataset.ytTweakedOriginal!;
            delete viewsNode.dataset.ytTweakedOriginal;
            delete viewsNode.dataset.ytTweaked;
            return { found: true as const };
        }, META_SELECTOR);
        expect(result.found, "fixture must contain a views node (Aufrufe)").toBe(true);

        await page.waitForTimeout(1500);

        const shortened = await page.evaluate((sel) => {
            const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
            const viewsNode = nodes.find((n) => n.dataset.ytTweakedOriginal?.includes("Aufrufe"));
            if (!viewsNode) return { found: false } as const;
            return { found: true as const, text: viewsNode.textContent ?? "" };
        }, META_SELECTOR);

        expect(shortened.found).toBe(true);
        // * e.g. "450.552 Aufrufe" → "450,6k Aufrufe" (number + locale word; de decimal comma).
        expect(shortened.text).toMatch(/ Aufrufe$/);
    });
});
