import { describe, expect, it } from "vitest";
import { changelogFor, decodeChangelog, parseChangelog } from "../about-changelog";

// * Sample mirrors the real release-please format (CHANGELOG.md), including the
//   inline link markdown the About tab must render as plain text.
const SAMPLE = [
    "# Changelog",
    "",
    "## [1.1.1](https://github.com/JanGaida/youtube-ui-tweaks/compare/a...b) (2026-10-25)",
    "",
    "",
    "### Bug Fixes",
    "",
    "* **release:** align the userscript [@version](https://github.com/version) with release 1.1.0",
    "",
    "## [1.1.0](https://github.com/JanGaida/youtube-ui-tweaks/compare/x...y) (2026-10-24)",
    "",
    "",
    "### Features",
    "",
    "* **app:** initial release ([ecff9d8](https://github.com/JanGaida/youtube-ui-tweaks/commit/ecff9d8))",
    "",
    "",
    "### Bug Fixes",
    "",
    "* **about:** read the version from GM_info instead of a hardcoded constant",
    "* **build:** publish src/lib/dev swallowed by the dev/ gitignore pattern",
    "",
].join("\n");

describe("parseChangelog", () => {
    it("parses sections with version, date, groups and bullets (newest first)", () => {
        expect(parseChangelog(SAMPLE)).toEqual([
            {
                version: "1.1.1",
                date: "2026-10-25",
                items: [
                    { kind: "group", text: "Bug Fixes" },
                    { kind: "bullet", text: "release: align the userscript @version with release 1.1.0" },
                ],
            },
            {
                version: "1.1.0",
                date: "2026-10-24",
                items: [
                    { kind: "group", text: "Features" },
                    { kind: "bullet", text: "app: initial release (ecff9d8)" },
                    { kind: "group", text: "Bug Fixes" },
                    { kind: "bullet", text: "about: read the version from GM_info instead of a hardcoded constant" },
                    { kind: "bullet", text: "build: publish src/lib/dev swallowed by the dev/ gitignore pattern" },
                ],
            },
        ]);
    });

    it("parses the real project changelog shape (CRLF line endings)", () => {
        const crlf = SAMPLE.split("\n").join("\r\n");
        expect(parseChangelog(crlf)).toHaveLength(2);
        expect(parseChangelog(crlf)[0].version).toBe("1.1.1");
    });

    it("tolerates unknown markdown lines and empty input", () => {
        expect(parseChangelog("")).toEqual([]);
        expect(parseChangelog("# Changelog\n\nSome free prose\n\n> quote")).toEqual([]);
    });
});

describe("decodeChangelog", () => {
    // * Mirrors the vite.config.ts encode step (Buffer base64, CRLF-normalized) so the
    //   bundle roundtrip is covered: encode here, decode in the parser consumer.
    function encodeLikeViteConfig(markdown: string): string {
        return Buffer.from(markdown.replace(/\r\n/g, "\n"), "utf-8").toString("base64");
    }

    it("round-trips the release-please markdown through base64", () => {
        const decoded = decodeChangelog(encodeLikeViteConfig(SAMPLE));
        expect(parseChangelog(decoded)).toEqual(parseChangelog(SAMPLE));
    });

    it("survives non-ASCII content (arrows, umlauts)", () => {
        const decoded = decodeChangelog(encodeLikeViteConfig("→ Beschreibung mit ü and é"));
        expect(decoded).toBe("→ Beschreibung mit ü and é");
    });
});

describe("changelogFor", () => {
    const entries = parseChangelog(SAMPLE);

    it("returns the matching entry for a known version", () => {
        expect(changelogFor(entries, "1.1.0")).toBe(entries[1]);
    });

    it("falls back to the newest entry for a foreign version (e2e stub)", () => {
        expect(changelogFor(entries, "0.0.0-polyfill")).toBe(entries[0]);
        expect(changelogFor([], "1.1.1")).toBeUndefined();
    });
});
