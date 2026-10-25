/**
 * jsdom fixture harness — loads a captured `.fixture.html` into a jsdom document so tests can
 * run selectors and feature transforms against real YouTube DOM structure.
 *
 * Fixtures live in `src/lib/core/__fixtures__/`. Each has a machine-readable `<fixture-meta>`
 * element and a captured DOM block. The harness parses both and exposes the document plus the
 * metadata.
 *
 * ? shadow-dom: jsdom has limited shadow-DOM support. Selectors ending in shadow DOM are marked
 *   `shadowBoundary: true` in the fixture meta; tests for such selectors should be skipped with
 *   a `// * shadow-dom: manually verified` comment.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Parsed fixture metadata (from the `<fixture-meta>` element's data attributes). */
export interface ParsedFixtureMeta {
    captured: string;
    locale: string;
    url: string;
    type: string;
    probeCounts: Record<string, { count: number; shadowBoundary: boolean }>;
}

/** Result of loading a fixture: a jsdom document with the captured DOM, plus its metadata. */
export interface LoadedFixture {
    /** The document with the fixture's captured DOM set as `document.body.innerHTML`. */
    dom: Document;
    /** The parsed fixture metadata. */
    meta: ParsedFixtureMeta;
    /** The raw fixture HTML content. */
    raw: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "..", "__fixtures__");

/**
 * True when the fixture file exists.
 *
 * ! Fixtures are DELIBERATELY gitignored (they contain real captured YouTube DOM). On a
 *   fresh clone (and in CI) they are absent — fixture-based tests must use
 *   `describe.skipIf(!fixtureExists(...))` so the whole suite stays green there, while
 *   running fully on a machine with captured fixtures. The skip is per-file so the
 *   affected tests remain visible as "skipped" in the report.
 *
 * @param name - The fixture name stem (e.g. "home-grid-item").
 */
export function fixtureExists(name: string): boolean {
    return existsSync(resolve(FIXTURES_DIR, `${name}.fixture.html`));
}

/**
 * Loads a fixture by name (without extension) from `__fixtures__/`.
 *
 * Sets the captured DOM as `document.body.innerHTML` so selectors run against the real YT
 * structure. Throws if the fixture file is missing.
 *
 * @param name - The fixture name stem (e.g. "home-grid-item").
 * @returns The loaded fixture (document + metadata + raw content).
 * @throws {Error} If the fixture file cannot be read.
 */
export function loadFixture(name: string): LoadedFixture {
    const filePath = resolve(FIXTURES_DIR, `${name}.fixture.html`);
    const raw = readFileSync(filePath, "utf-8");

    // * Parse the <fixture-meta> element's data attributes.
    const metaMatch = raw.match(/<fixture-meta\s+([^>]+)><\/fixture-meta>/);
    const meta: ParsedFixtureMeta = {
        captured: "",
        locale: "",
        url: "",
        type: name,
        probeCounts: {},
    };
    if (metaMatch) {
        const attrs = metaMatch[1];
        const get = (key: string): string => {
            const m = attrs.match(new RegExp(`${key}="([^"]*)"`));
            return m ? m[1] : "";
        };
        meta.captured = get("data-captured");
        meta.locale = get("data-locale");
        meta.url = get("data-url");
        meta.type = get("data-type") || name;
        const probeCountsRaw = attrs.match(/data-probe-counts='([^']*)'/);
        if (probeCountsRaw) {
            try {
                meta.probeCounts = JSON.parse(probeCountsRaw[1].replace(/&quot;/g, '"'));
            } catch {
                // * Malformed probe-counts JSON — leave empty.
            }
        }
    }

    // * Extract the captured DOM block (everything after the "<!-- captured DOM -->" marker).
    const domMarker = raw.indexOf("<!-- captured DOM -->");
    const domHtml = domMarker >= 0 ? raw.slice(domMarker + "<!-- captured DOM -->".length).trim() : raw;

    document.body.innerHTML = domHtml;

    return { dom: document, meta, raw };
}
