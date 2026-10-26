/**
 * Parser for the release-please-generated CHANGELOG.md embedded via `__CHANGELOG_B64__`
 * (see vite.config.ts, ADR 0010).
 *
 * Pure + node-env testable: `npm run test` covers it without a browser, the About
 * tab consumes the parsed result at runtime (AboutTab.svelte).
 *
 * ! Parses the actual release-please format, not arbitrary markdown:
 *   `## [1.1.1](compare-url) (2026-10-25)` sections with `### Group` headers and
 *   `* **scope:** message` bullets. Unknown lines are skipped — forward-compatible.
 */

export interface ChangelogItem {
    kind: "group" | "bullet";
    text: string;
}

export interface ChangelogEntry {
    version: string;
    date: string;
    items: ChangelogItem[];
}

/** `## [1.1.1](…/compare/… ) (2026-10-25)` */
const HEADING_RE = /^## \[(.+?)\].*?\((\d{4}-\d{2}-\d{2})\)/;
/** `### Bug Fixes` */
const GROUP_RE = /^### (.+)$/;
/** `* **scope:** message` */
const BULLET_RE = /^\* (.+)$/;

const LINK_RE = /\[([^\]]+)\]\([^)]*\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

/** Renders markdown inline syntax as plain text (link labels kept, bold markers dropped). */
function plainText(raw: string): string {
    return raw.replace(LINK_RE, "$1").replace(BOLD_RE, "$1").trim();
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let current: ChangelogEntry | null = null;

    for (const line of markdown.split(/\r?\n/)) {
        const heading = line.match(HEADING_RE);
        if (heading) {
            current = { version: heading[1].trim(), date: heading[2], items: [] };
            entries.push(current);
            continue;
        }
        if (!current) continue;

        const group = line.match(GROUP_RE);
        if (group) {
            current.items.push({ kind: "group", text: group[1].trim() });
            continue;
        }

        const bullet = line.match(BULLET_RE);
        if (bullet) {
            const text = plainText(bullet[1]);
            if (text) current.items.push({ kind: "bullet", text });
            continue;
        }
    }
    return entries;
}

/**
 * Decodes the BASE64-encoded `__CHANGELOG_B64__` literal (ADR 0010) back into the
 * markdown text — `atob` + `TextDecoder` so non-ASCII content (arrows, umlauts)
 * survives the browser-native decode.
 */
export function decodeChangelog(encoded: string): string {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Entry for an installed version — falls back to the newest entry for foreign or
 * placeholder versions (e.g. the e2e GM_info stub), so the About tab never renders
 * an empty changelog. `entries` are newest-first (release-please format).
 */
export function changelogFor(entries: ChangelogEntry[], version: string): ChangelogEntry | undefined {
    return entries.find((entry) => entry.version === version) ?? entries[0];
}
