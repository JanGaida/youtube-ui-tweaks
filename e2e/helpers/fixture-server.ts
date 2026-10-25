import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createServer, type Server } from "node:http";

/**
 * Fixture server — serves captured `.fixture.html` files as renderable HTML documents.
 *
 * Captured fixtures are raw HTML fragments (comment header + `<fixture-meta>` + computed
 * `<style>` + captured DOM). jsdom loads them by parsing the file directly, but a browser
 * needs a proper HTML document wrapper so the captured DOM lands in `document.body` and the
 * captured `<style>` applies.
 *
 * The server wraps each fixture's DOM block (everything after the `<!-- captured DOM -->`
 * marker) into a minimal HTML document at `<body>`, and injects the captured `<style>` into
 * `<head>` (extracted from the fixture's `<style id="fixture-computed">` block).
 *
 * ! Implemented on `node:http` (not Vite middleware) — Vite's built-in 404 handler runs
 *   before custom middleware and swallows fixture routes. A bare HTTP server is simpler and
 *   avoids ordering pitfalls for static HTML delivery.
 */

const FIXTURES_DIR = resolve(process.cwd(), "src/lib/core/__fixtures__");

// * Single source of truth for the fixture-server port — global-setup and the Playwright
//   baseURL both import it (a hardcoded duplicate in the config drifts silently).
export const FIXTURE_SERVER_PORT = 4174;

export interface FixtureServer {
    /** Stops the underlying HTTP server. */
    close: () => Promise<void>;
    /** Base URL (e.g. `http://localhost:4174`). */
    base: string;
}

/**
 * Extracts the captured DOM block (after `<!-- captured DOM -->`) and the computed-style
 * `<style>` block from a raw fixture file.
 *
 * @param raw - The raw fixture file content.
 * @returns `{ dom, style }` — the captured DOM HTML and the computed-style CSS (empty if none).
 */
function splitFixture(raw: string): { dom: string; style: string } {
    const domMarker = raw.indexOf("<!-- captured DOM -->");
    const dom = domMarker >= 0 ? raw.slice(domMarker + "<!-- captured DOM -->".length).trim() : raw;

    // * Extract the captured <style id="fixture-computed">…</style> block contents (if present).
    const styleMatch = raw.match(/<style id="fixture-computed"[^>]*>([\s\S]*?)<\/style>/);
    const style = styleMatch ? styleMatch[1].trim() : "";
    return { dom, style };
}

/**
 * Wraps a fixture's DOM + computed styles into a renderable HTML document.
 *
 * @param name   - Fixture name stem (e.g. "home-grid-item").
 * @param raw    - The raw fixture file content.
 * @returns A full HTML document string serving the fixture.
 */
function wrapFixture(name: string, raw: string): string {
    const { dom, style } = splitFixture(raw);
    return `<!DOCTYPE html>
<html lang="de-DE">
<head>
<meta charset="utf-8">
<title>fixture:${name}</title>
<!-- fixture-computed (captured styles) -->
<style id="fixture-computed" data-yt-tweaks-fixture>
${style}
</style>
</head>
<body>
<!-- captured DOM -->
${dom}
</body>
</html>
`;
}

/**
 * Starts an HTTP server that serves wrapped fixtures at `/<name>.fixture.html`.
 *
 * Scans `__fixtures__/` once at startup to build the route map. Unknown paths return 404.
 *
 * @param port - Port to listen on (default FIXTURE_SERVER_PORT, chosen to avoid vite dev's 5173).
 * @returns The running server handle (call `.close()` in teardown).
 */
export async function startFixtureServer(port = FIXTURE_SERVER_PORT): Promise<FixtureServer> {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".fixture.html"));
    const routes = new Map<string, string>();
    for (const file of files) {
        const stem = basename(file, ".fixture.html");
        const raw = readFileSync(resolve(FIXTURES_DIR, file), "utf-8");
        routes.set(`${stem}.fixture.html`, wrapFixture(stem, raw));
    }

    return new Promise((resolvePromise, rejectPromise) => {
        const server: Server = createServer((req, res) => {
            const url = (req.url ?? "").split("?")[0].replace(/^\//, "");
            const body = routes.get(url);
            if (body) {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(body);
                return;
            }
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end(`fixture not found: ${url}`);
        });
        server.on("error", rejectPromise);
        server.listen(port, () => {
            const base = `http://localhost:${port}`;
            resolvePromise({
                close: () => new Promise<void>((res) => server.close(() => res())),
                base,
            });
        });
    });
}
