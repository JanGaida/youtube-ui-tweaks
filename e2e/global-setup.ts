import { startFixtureServer, FIXTURE_SERVER_PORT, type FixtureServer } from "./helpers/fixture-server";

/**
 * Playwright globalSetup — starts the fixture server and exposes its handle via a module
 * global so tests + teardown can read the base URL.
 *
 * ! Runs once before all tests. The server serves `__fixtures__/*.fixture.html` wrapped as
 *   renderable HTML documents at http://localhost:4174.
 */

let server: FixtureServer | null = null;

export default async function globalSetup(): Promise<void> {
    server = await startFixtureServer(FIXTURE_SERVER_PORT);
    console.log(`[e2e] fixture server ready at ${server.base}`);
}

/** Returns the running fixture server (throws if globalSetup hasn't run). */
export function getFixtureServer(): FixtureServer {
    if (!server) throw new Error("fixture server not started — globalSetup missing?");
    return server;
}
