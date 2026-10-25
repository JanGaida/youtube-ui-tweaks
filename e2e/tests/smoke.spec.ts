import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript } from "../helpers/userscript";
import { invokeGmCommand } from "../helpers/gm-polyfill";

/**
 * Smoke test — verifies the userscript boots against a hosted fixture.
 *
 * Proves the injection pipeline end-to-end:
 * - GM polyfill installs the four `GM_*` globals before the script runs.
 * - The userscript injects its `<style id="yt-tweaks-css">` at boot.
 * - The settings panel mounts via the registered "Einstellungen" menu command.
 *
 * ? Fixture chosen: `home-grid-item.fixture.html` (the largest, most representative).
 *   If the script boots here, it boots on any fixture.
 *
 * ! The userscript is injected AFTER load (via evaluate), not via addInitScript — see
 *   helpers/userscript.ts for why (Tampermonkey @run-at document-start assumption).
 */

const FIXTURE = "/home-grid-item.fixture.html";

test.describe("smoke: userscript injection", () => {
    test("injects GM_* globals before script boot", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * GM_getValue installed by the polyfill (via addInitScript, persists).
        const gmType = await page.evaluate(() => typeof (window as any).GM_getValue);
        expect(gmType).toBe("function");
    });

    test("injects the tweak stylesheet", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        const style = page.locator("#yt-tweaks-css");
        await expect(style).toBeAttached();
        // * The generated CSS contains tweak-scoped rules (font-size, line-height). At minimum
        //   the element must have non-empty textContent.
        const css = await style.textContent();
        expect(css).toBeTruthy();
        expect(css!.length).toBeGreaterThan(0);
    });

    test("mounts the settings panel via the Einstellungen command", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Panel mounts lazily via GM_registerMenuCommand("Einstellungen", openSettings).
        //   Invoke the registered command from within the page.
        const invoked = await invokeGmCommand(page, "Einstellungen");
        expect(invoked).toBe(true);

        // * The panel root carries the `.yt-tweaks-panel` class (see App.svelte + panel.css).
        await expect(page.locator(".yt-tweaks-panel")).toBeVisible({ timeout: 5000 });
    });
});
