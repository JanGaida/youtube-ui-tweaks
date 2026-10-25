import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

/**
 * Vitest configuration.
 *
 * Two test environments, selected per-file via docblock annotation (vitest v4 API):
 *
 * - `node` (default): pure-logic tests (formatViewsNumber, detectPage, registry dispatch, CSS
 *   string builders). No DOM.
 * - `jsdom`: DOM/fixture tests — annotate the test file with `// @vitest-environment jsdom` to
 *   opt in. Used for selector match against captured YouTube HTML and feature transforms on real
 *   DOM.
 */
export default defineConfig({
    plugins: [svelte()],
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        setupFiles: ["src/lib/core/__tests__/setup.ts"],
    },
});
