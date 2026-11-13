import type { Settings } from "./settings";
import { generateCSS as registryGenerateCSS } from "./registry";
import { buildPageCtx } from "./page";
import log, { SCOPES } from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: CSS injection — boot-time + registry-delegated generation
// ─────────────────────────────────────────────────────────────────────────────
// * generateCSS delegates to the FeatureRegistry (aggregates per-feature css behaviors for
//   the current page). injectCSSString is the single DOM injector shared by the boot path
//   (applyCSS) and runtime re-injection (observer.ts via the registry).

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
 * Injects (or updates) the `<style>` element with the given CSS string.
 *
 * Safe at `document-start`: falls back to `document.documentElement` when `document.head` is
 * absent. Uses `textContent` (Trusted-Types-safe, never `innerHTML`).
 *
 * @param css - The CSS string to inject.
 * @param id  - DOM id of the style element (defaults to {@link STYLE_ID}).
 */
export function injectCSSString(css: string, id: string = STYLE_ID): void {
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (el) {
        el.textContent = css;
        log.debug(SCOPES.CSS, `style#${id} updated`, { chars: css.length });
        return;
    }
    el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    // ! document.head may be null at document-start → documentElement fallback
    const mount = document.head || document.documentElement;
    if (!mount) {
        log.error(SCOPES.CSS, "no mount point (document.head & documentElement null)", { id });
        return;
    }
    mount.appendChild(el);
    log.debug(SCOPES.CSS, `style#${id} mounted`, {
        mount: mount === document.head ? "head" : "documentElement",
        chars: css.length,
    });
}

/**
 * Generates the CSS for the given settings and injects it.
 *
 * @param settings - The current settings.
 */
export function applyCSS(settings: Settings): void {
    injectCSSString(generateCSS(settings), STYLE_ID);
}
