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

export default defineConfig({
    define: {
        __DEV_CAPTURE__: JSON.stringify(DEV_CAPTURE),
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
                version: "1.1.0", // x-release-please-version
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
