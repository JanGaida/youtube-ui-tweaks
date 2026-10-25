import { getFixtureServer } from "./global-setup";

/**
 * Playwright globalTeardown — stops the fixture server started in globalSetup.
 *
 * Runs once after all tests. Safe to call even if some tests failed.
 */
export default async function globalTeardown(): Promise<void> {
    await getFixtureServer().close();
    console.log("[e2e] fixture server stopped");
}
