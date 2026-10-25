import type { Settings } from "./settings";
import { generateCSS as registryGenerateCSS } from "./registry";
import { buildPageCtx } from "./page";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: CSS injection — boot-time + registry-delegated generation
// ─────────────────────────────────────────────────────────────────────────────
// * generateCSS now delegates to the FeatureRegistry (aggregates per-feature css behaviors for
//   the current page). applyCSS is the boot-time injector (document-start safe). Runtime
//   re-injection is handled by observer.injectCSS (registry-produced string).

/** DOM id of the injected `<style>` element holding all generated tweak CSS rules. */
export const STYLE_ID = "yt-tweaks-css";

/**
 * Generates the full CSS string for the given settings by delegating to the FeatureRegistry.
 *
 * Builds an ad-hoc PageCtx (used when PageContext is not yet initialized, e.g. boot).
 *
 * @param settings - The current settings.
 * @returns A newline-joined CSS string.
 */
export function generateCSS(settings: Settings): string {
    const ctx = buildPageCtx(settings);
    return registryGenerateCSS(settings, ctx);
}

/**
 * Injects (or updates) the `<style>` element with the generated CSS.
 *
 * Safe at `document-start`: falls back to `document.documentElement` when `document.head` is
 * absent. Uses `textContent` (Trusted-Types-safe, never `innerHTML`).
 *
 * @param settings - The current settings.
 */
export function applyCSS(settings: Settings): void {
    const css = generateCSS(settings);
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (el) {
        el.textContent = css;
        return;
    }
    el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    // ! document.head may be null at document-start → documentElement fallback
    const mount = document.head || document.documentElement;
    if (!mount) {
        log.error("css", "no mount point (document.head & documentElement null)");
        return;
    }
    mount.appendChild(el);
    log.debug(
        "css",
        `style#${STYLE_ID} mounted on ${mount === document.head ? "head" : "documentElement"} (${css.length} chars)`,
    );
}
