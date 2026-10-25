import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectUserscriptAfterLoad } from "../helpers/userscript";

/**
 * Ads-hide E2E — verifies the ads feature's CSS output + the kill-switch restore path.
 *
 * The home-grid fixture contains no promo/member elements to actually hide (DOM pass is a
 * no-op here), so this test focuses on:
 * - The premium-banner CSS rule is emitted (default `hidePremiumBanner: true`).
 * - The kill-switch (`system.tweaksEnabled=false`) restore path re-shows elements previously
 *   marked `data-yt-tweaks-hidden` (simulated) — proves the registry restore contract works in a
 *   real browser.
 *
 * ! The kill-switch is toggled via `GM_setValue` + reload (NOT the dev-only TM-menu command — that
 *   is dead-code-eliminated in the prod build the E2E suite injects). Same pattern as
 *   panel-interaction.spec.ts. The TM-menu entry is dev-only and covered by manual smoke-testing.
 *
 * ! Promo/member fixtures are not yet captured (see ads-hide.ts comment). When added, extend
 *   this test with a real DOM-hide assertion against those fixtures.
 */

const FIXTURE = "/home-grid-item.fixture.html";
const PLAYABLES_FIXTURE = "/playables-shelf.fixture.html";

test.describe("ads-hide", () => {
    test("premium-banner CSS rule is present by default", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        const css = await page.locator("#yt-tweaks-css").textContent();
        expect(css).toBeTruthy();
        expect(css!).toContain("ytd-banner-promo-renderer");
        expect(css!).toContain("ytd-mealbar-promo-renderer");
    });

    test("kill-switch restore re-shows a simulated hidden element", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Simulate an ads-hide result: mark a grid item as hidden (data-yt-tweaks-hidden +
        //   display:none), as hideElement() would. The kill-switch restore path should undo it.
        const marked = await page.evaluate(() => {
            const el = document.querySelector<HTMLElement>("ytd-rich-item-renderer");
            if (!el) return false;
            el.style.display = "none";
            el.dataset.ytTweaksHidden = "1";
            return true;
        });
        expect(marked).toBe(true);

        // * Disable tweaks via the settings JSON (`system.tweaksEnabled=false`) + reload — the
        //   script boots with the kill-switch off and `restoreAll()` removes all tweak markers.
        //   ! Same GM+reload pattern as panel-interaction.spec.ts (the store is a module singleton,
        //   not globally reachable from page.evaluate).
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.system = current.system || {};
            current.system.tweaksEnabled = false;
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });
        await page.reload();
        await injectUserscriptAfterLoad(page, false);

        // * Small delay: the script runs at document-start but restoreAll runs during boot;
        //   let one microtask settle before reading.
        const restored = await page.evaluate(() => {
            const el = document.querySelector<HTMLElement>("ytd-rich-item-renderer");
            if (!el) return null;
            return {
                hiddenAttr: el.dataset.ytTweaksHidden,
                display: el.style.display,
            };
        });
        expect(restored).not.toBeNull();
        expect(restored!.hiddenAttr).toBeUndefined();
        expect(restored!.display).toBe("");
    });

    // * Playables shelf: default keeps it visible; hidePlayablesShelf=true hides the entire
    // * outer rich-section via the :has(ytd-mini-game-card-view-model) CSS rule (real DOM effect,
    // * not just rule emission — proves the selector matches the captured shelf markup).
    test("playables shelf hidden via CSS :has() when hidePlayablesShelf is enabled", async ({ page }) => {
        await openFixtureWithUserscript(page, PLAYABLES_FIXTURE, false);

        // * Default settings: hidePlayablesShelf=false → no rule → shelf visible.
        expect(await page.locator("ytd-rich-section-renderer:has(ytd-mini-game-card-view-model)").isVisible()).toBe(
            true,
        );

        // * Enable the toggle via settings JSON + reload (same GM+reload pattern as above).
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.ads = current.ads || {};
            current.ads.shelves = current.ads.shelves || {};
            current.ads.shelves.enabled = true;
            current.ads.shelves.hidePlayablesShelf = true;
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });
        await page.reload();
        await injectUserscriptAfterLoad(page, false);

        const css = await page.locator("#yt-tweaks-css").textContent();
        expect(css!).toContain("ytd-mini-game-card-view-model");
        expect(await page.locator("ytd-rich-section-renderer:has(ytd-mini-game-card-view-model)").isVisible()).toBe(
            false,
        );
    });
});
