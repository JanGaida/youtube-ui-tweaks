import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import monkey from "vite-plugin-monkey";

/**
 * Vite configuration for the YouTube UI Tweaks userscript.
 *
 * Build modes (selected via env var, see package.json scripts):
 *
 * - `npm run build` (prod): `YT_DEV_CAPTURE` unset → `__DEV_CAPTURE__` is `false`, capture code
 *   is dead-code-eliminated, `minify` is enabled, artifact is `dist/youtube-ui-tweaks.user.js`.
 * - `npm run build:dev` (dev): `YT_DEV_CAPTURE=1` → `__DEV_CAPTURE__` is `true`, capture code is
 *   included, `minify` is disabled for readable debugging, artifact is
 *   `dist/youtube-ui-tweaks.dev.user.js` (distinct name so E2E `dev` mode provably tests the
 *   dev artifact and never silently loads the prod build).
 */
const DEV_CAPTURE = process.env.YT_DEV_CAPTURE === "1";

// * CHANGELOG.md is read at BUILD time and embedded into the bundle via `define`
//   (ADR 0010). The release PR bumps CHANGELOG.md and the `@version` header in the
//   same merge → the About tab always renders the changelog matching the built
//   header, with zero runtime fetch (no GM_xmlhttpRequest, no YouTube-CSP risk).
// * The content is NEWLINE-NORMALIZED (CRLF → LF, no platform variance) and embedded
//   BASE64-ENCODED (decoded in about-changelog.ts): the bundle carries one compact,
//   non-readable literal instead of a multi-line raw-text block users would see.
const CHANGELOG_MD = readFileSync(fileURLToPath(new URL("./CHANGELOG.md", import.meta.url)), "utf-8").replace(
    /\r\n/g,
    "\n",
);
const CHANGELOG_B64 = Buffer.from(CHANGELOG_MD, "utf-8").toString("base64");

export default defineConfig({
    define: {
        __DEV_CAPTURE__: JSON.stringify(DEV_CAPTURE),
        __CHANGELOG_B64__: JSON.stringify(CHANGELOG_B64),
    },

    build: {
        // Prod is minified; the dev build stays readable for debugging.
        minify: !DEV_CAPTURE,
        sourcemap: false,
    },

    plugins: [
        svelte(),
        monkey({
            entry: "src/main.ts",

            build: {
                fileName: DEV_CAPTURE ? "youtube-ui-tweaks.dev.user.js" : "youtube-ui-tweaks.user.js",
            },

            userscript: {
                name: "YouTube UI Tweaks",
                description: "Runtime-based UI tweaks for YouTube.",
                namespace: "https://github.com/JanGaida/youtube-ui-tweaks",
                author: "Jan Gaida",
                license: "GPL-3.0",
                version: "1.2.0", // x-release-please-version
                icon: "https://cdn.jsdelivr.net/gh/JanGaida/youtube-ui-tweaks@main/src/assets/icon.svg",
                match: ["https://www.youtube.com/*"],
                grant: ["GM_getValue", "GM_setValue", "GM_registerMenuCommand"],
                "run-at": "document-start",
                homepage: "https://github.com/JanGaida/youtube-ui-tweaks",
                updateURL:
                    "https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js",
                downloadURL:
                    "https://github.com/JanGaida/youtube-ui-tweaks/releases/latest/download/youtube-ui-tweaks.user.js",
            },
        }),
    ],
});
