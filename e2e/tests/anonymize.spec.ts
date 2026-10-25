import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectUserscriptAfterLoad } from "../helpers/userscript";

/**
 * Anonymize-layer E2E — verifies the blur `<style>` mounts/unmounts with the toggle.
 *
 * Toggles `system.anonymize` via `GM_setValue` + reload (NOT the dev-only TM-menu command — that
 * is dead-code-eliminated in the prod build the E2E suite injects). Same pattern as
 * panel-interaction.spec.ts.
 *
 * ! The anonymize layer is independent of the kill-switch: it mounts its own `<style id=
 * "yt-tweaks-anonymize-css">` regardless of `system.tweaksEnabled`. This test keeps
 * `tweaksEnabled=true` (default) and only flips `anonymize`.
 */

const FIXTURE = "/home-grid-item.fixture.html";
const ANON_STYLE_ID = "yt-tweaks-anonymize-css";

test.describe("anonymize layer", () => {
    test("is not mounted by default (anonymize off)", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Default: anonymize=false → no anonymize style element present.
        const style = page.locator(`#${ANON_STYLE_ID}`);
        await expect(style).toHaveCount(0);
    });

    test("mounts the blur style when enabled via settings + reload", async ({ page }) => {
        await openFixtureWithUserscript(page, FIXTURE, false);

        // * Enable anonymize via the settings JSON + reload.
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.system = current.system || {};
            current.system.anonymize = true;
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });
        await page.reload();
        await injectUserscriptAfterLoad(page, false);

        // * The anonymize style must be present and contain the blur rules.
        const style = page.locator(`#${ANON_STYLE_ID}`);
        await expect(style).toBeAttached();
        const css = await style.textContent();
        expect(css).toBeTruthy();
        // * Blur on grid-item metadata (title + meta + avatar container).
        expect(css!).toContain(".ytLockupViewModelMetadata");
        // * Blur on video thumbnails (the user's main concern: preview images anonymized).
        expect(css!).toContain(".ytThumbnailViewModelImage");
        // * Blur on the watch-page video player frame.
        expect(css!).toContain("#movie_player video");
        expect(css!).toContain("filter: blur(");
    });

    test("removes the blur style when disabled via settings + reload", async ({ page }) => {
        // * Start with anonymize enabled.
        await openFixtureWithUserscript(page, FIXTURE, false);
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.system = current.system || {};
            current.system.anonymize = true;
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });
        await page.reload();
        await injectUserscriptAfterLoad(page, false);
        await expect(page.locator(`#${ANON_STYLE_ID}`)).toBeAttached();

        // * Disable anonymize + reload → style removed.
        await page.evaluate(() => {
            const w = window as any;
            const current = JSON.parse(w.GM_getValue("ytTweaksSettings", "{}"));
            current.system = current.system || {};
            current.system.anonymize = false;
            w.GM_setValue("ytTweaksSettings", JSON.stringify(current));
        });
        await page.reload();
        await injectUserscriptAfterLoad(page, false);

        await expect(page.locator(`#${ANON_STYLE_ID}`)).toHaveCount(0);
    });
});
