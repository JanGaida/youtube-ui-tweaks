import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectGmPolyfill, injectUserscriptAfterLoad } from "../helpers/userscript";

/**
 * CSS-injection E2E — verifies the tweak stylesheet contains the expected default rules.
 *
 * The userscript generates CSS from the feature registry (grid-styling, ads-hide). Defaults
 * are applied on boot. This test asserts the generated `<style>` carries the default
 * font-size and the premium-banner display:none rule.
 *
 * ! Proves the full pipeline: build → inject → boot → generateCSS → applyCSS. If the
 *   registry or CSS builder regresses, the style content drifts and this test fails.
 */

const FIXTURE = "/home-grid-item.fixture.html";

test.describe("css injection", () => {
    test("stylesheet contains default title size preset rule (medium = 1.35/1.85rem)", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        const css = await page.locator("#yt-tweaks-css").textContent();
        expect(css).toBeTruthy();
        // * DEFAULT_SETTINGS.styling.titleSize = "medium" — preset pair font-size/line-height.
        expect(css!).toContain("1.35rem");
        expect(css!).toContain("1.85rem");
    });

    test("stylesheet contains hide-elements rule when hideVerifiedBadge is enabled", async ({ page }) => {
        // * Polyfill first (provides GM_setValue), then seed settings via GM storage BEFORE the
        //   userscript boots (the script reads GM_getValue at boot) — mirrors panel-interaction.spec.
        await injectGmPolyfill(page);
        await page.goto(FIXTURE);
        await page.evaluate(() => {
            const w = window as any;
            w.GM_setValue(
                "ytTweaksSettings",
                JSON.stringify({ hideElements: { enabled: true, hideVerifiedBadge: true } }),
            );
        });
        await injectUserscriptAfterLoad(page, false);

        const css = await page.locator("#yt-tweaks-css").textContent();
        expect(css).toBeTruthy();
        // * aria-label anchor (live-verified 2026-09-12): the checkmark renders as a SIBLING
        //   of the channel link with aria-label="Bestätigt"/"Verified" — not inside the link.
        expect(css!).toContain('.ytContentMetadataViewModelIcon[aria-label="Bestätigt"]');
        expect(css!).toContain('.ytContentMetadataViewModelIcon[aria-label="Verified"]');
    });

    test("stylesheet contains premium-banner hiding rule when ads.hidePremiumBanner is default true", async ({
        page,
    }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        const css = await page.locator("#yt-tweaks-css").textContent();
        expect(css).toBeTruthy();
        // * ads-hide feature emits: `ytd-banner-promo-renderer, ... { display: none !important; }`
        expect(css!).toContain("ytd-banner-promo-renderer");
        expect(css!).toContain("display: none !important");
    });
});
