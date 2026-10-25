import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { buildGmPolyfillInitScript } from "./gm-polyfill";

/**
 * Loads the built userscript file content from `dist/`.
 *
 * The userscript file is a single IIFE preceded by a `// ==UserScript==` metadata header
 * (JS comments). The entire file is valid JS and runs as-is when evaluated.
 *
 * ! Requires a prior build (`npm run build` or `npm run build:dev`). Throws if the file is
 *   missing — fail fast rather than silently injecting nothing.
 *
 * ! Dev and prod builds write DIFFERENT file names (youtube-ui-tweaks.dev.user.js vs
 *   youtube-ui-tweaks.user.js) — a dev run can never silently fall back to the prod build.
 *
 * @param dev - When true, loads the dev build (capture tooling present); else the prod build.
 * @returns The raw userscript source string.
 */
export function loadUserscriptSource(dev = false): string {
    const flag = dev ? "dev" : "prod";
    const fileName = dev ? "youtube-ui-tweaks.dev.user.js" : "youtube-ui-tweaks.user.js";
    const distPath = resolve(process.cwd(), "dist", fileName);
    try {
        const content = readFileSync(distPath, "utf-8");
        if (!content.startsWith("// ==UserScript==")) {
            throw new Error(`unexpected userscript header (build=${flag})`);
        }
        return content;
    } catch (e) {
        throw new Error(
            `Failed to read built userscript at ${distPath}. Run "npm run build${dev ? ":dev" : ""}" first. Cause: ${(e as Error).message}`,
        );
    }
}

/**
 * Injects the GM polyfill into a page so it runs before every navigation.
 *
 * ! Uses `addInitScript` — installed ONCE, persists across reloads. The polyfill guards
 *   against the pre-document-start window where `document.documentElement` is null (Playwright
 *   runs init scripts earlier than Tampermonkey's `@run-at document-start`).
 *
 * ! The USERSCRIPT is NOT injected here — see {@link injectUserscriptAfterLoad}. The userscript
 *   was written for Tampermonkey's `@run-at document-start` and assumes `documentElement` exists;
 *   injecting it via `addInitScript` would run it too early and crash `detectLocale`.
 *
 * @param page - The Playwright page to inject the polyfill into.
 */
export async function injectGmPolyfill(page: Page): Promise<void> {
    await page.addInitScript(buildGmPolyfillInitScript());
}

/**
 * Injects the built userscript into a page via `evaluate`, AFTER a navigation completes.
 *
 * The userscript assumes Tampermonkey's `@run-at document-start` guarantees (a document root
 * exists). Playwright's `addInitScript` runs earlier than that, so we inject the script after
 * `page.goto` returns — by then the document is parsed and `documentElement` is present. This
 * loses FOUC-avoidance (irrelevant for static fixtures) but matches the script's expectations.
 *
 * ! The polyfill MUST already be installed via {@link injectGmPolyfill} before calling this.
 *   `addInitScript` re-runs the polyfill on navigation; `evaluate` runs once for the injection.
 *
 * @param page   - The Playwright page (must have already navigated to the fixture).
 * @param dev    - When true, inject the dev build (capture tooling); else the prod build.
 */
export async function injectUserscriptAfterLoad(page: Page, dev = false): Promise<void> {
    const userscript = loadUserscriptSource(dev);
    await page.evaluate((src) => {
        // * Execute the userscript IIFE in the page context. The metadata header (// comments)
        //   is inert; the IIFE runs and consumes the already-installed GM_* globals.
        (0, eval)(src);
    }, userscript);
}

/**
 * Convenience: installs the polyfill, navigates, then injects the userscript after load.
 *
 * @param page     - The Playwright page.
 * @param url      - Fixture URL path (relative to baseURL) or absolute.
 * @param dev      - When true, inject the dev build; else the prod build.
 */
export async function openFixtureWithUserscript(page: Page, url: string, dev = false): Promise<void> {
    await injectGmPolyfill(page);
    await page.goto(url);
    await injectUserscriptAfterLoad(page, dev);
}
