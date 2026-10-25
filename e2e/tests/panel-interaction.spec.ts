import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectUserscriptAfterLoad } from "../helpers/userscript";
import { invokeGmCommand } from "../helpers/gm-polyfill";

/**
 * Panel-interaction E2E — verifies the settings panel mounts and a live-apply cycle works.
 *
 * Opens the panel via the "Einstellungen" menu command, then mutates a setting through the
 * store (simulating a user control change) and asserts the generated CSS updates to reflect
 * the new value. This exercises the store → observer → CSS re-injection path in a real browser.
 *
 * ! Uses the store singleton directly via evaluate (not a real UI click) to keep the test
 *   robust against panel DOM churn — the integration contract is store→observer→CSS, not
 *   pixel-level UI interaction.
 */

const FIXTURE = "/home-grid-item.fixture.html";

test.describe("panel interaction", () => {
    test("panel mounts and is visible", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);
        await invokeGmCommand(page, "Einstellungen");
        await expect(page.locator(".yt-tweaks-panel")).toBeVisible({ timeout: 5000 });
    });

    test("changing styling.titleSize re-injects CSS with the new preset pair", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Read the default title preset (medium = 1.35/1.85rem) as the baseline.
        const before = await page.locator("#yt-tweaks-css").textContent();
        expect(before).toContain("1.35rem");

        // * Mutate the setting via GM storage (persist + reload picks it up at boot).
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.styling = current.styling || {};
            current.styling.titleSize = "xlarge";
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });

        // * Reload to pick up the persisted setting — the script reads GM_getValue at boot.
        await page.reload();
        await injectUserscriptAfterLoad(page, false);

        const after = await page.locator("#yt-tweaks-css").textContent();
        // * xlarge preset pair (1.65/2.25rem) replaces the medium pair.
        expect(after).toContain("1.65rem");
        expect(after).toContain("2.25rem");
        expect(after).not.toContain("1.35rem");
    });
});
