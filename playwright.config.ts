import { defineConfig, devices } from "@playwright/test";
import { FIXTURE_SERVER_PORT } from "./e2e/helpers/fixture-server";

/**
 * Playwright configuration — E2E tests against locally hosted fixtures.
 *
 * ! This config must NEVER hit live YouTube (the fixture server serves captured DOM only).
 *   If live-capture E2E is ever added, give it a SEPARATE config so this invariant stays
 *   enforceable.
 *
 * Two pieces run here:
 * - globalSetup: starts the fixture server (node:http) serving wrapped
 *   `__fixtures__/*.fixture.html` as renderable HTML documents.
 * - tests: inject the built userscript via evaluate + GM polyfill (addInitScript), then
 *   assert CSS injection, text-shorten, ads-hide, and panel interaction.
 *
 * ! E2E tests run in Firefox (the userscript's target platform). Run `npm run build`
 *   (or `build:dev` for the capture-instrumented tests) first.
 *
 * ~ fullyParallel stays true (project default) but workers=1 makes the run serial anyway —
 *   a single bare-http server serving a ~1.7MB home-grid fixture chokes on parallel gotos,
 *   so the worker limit is the real serialization, not the flag.
 */
export default defineConfig({
    testDir: "./e2e/tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // * Single worker: the fixture server is a bare http server and the home-grid fixture is
    //   ~1.7MB — parallel goto against one server causes load timeouts. Serial is simpler and
    //   fast enough for the small suite.
    workers: 1,
    timeout: 60000,
    reporter: "list",
    use: {
        baseURL: `http://localhost:${FIXTURE_SERVER_PORT}`,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },
    ],
    globalSetup: "./e2e/global-setup.ts",
    globalTeardown: "./e2e/global-teardown.ts",
});
