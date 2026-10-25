import type { Settings } from "./settings";
import { detectLocale } from "./locale";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: PageContext — YouTube SPA page detection + context snapshot
// ─────────────────────────────────────────────────────────────────────────────
// * Detects which YouTube SPA subpage the user is on (home/channel/watch/...) from the URL,
//   confirmed by a DOM cue. Listens to SPA navigation events to re-detect on route change and
//   re-detect the content locale (fixes the stale-locale bug where detectLocale ran once at boot).
// * PageType is also the Feature `pages` map key; "*" is a quasi-wildcard (never a detection
//   result — features use it as a fallback).

/** YouTube SPA subpage types. "*" is a feature-level wildcard, never returned by detectPage. */
export type PageType = "home" | "subscriptions" | "channel" | "watch" | "search" | "shorts" | "*";

/** Minimal DOM probe interface — decouples detectPage from the real document (testable). */
export interface DomProbe {
    /** Returns true if at least one element matches the given selector. */
    has?: (selector: string) => boolean;
}

/** Immutable page-context snapshot passed to feature behaviors (css/run/restore). */
export interface PageCtx {
    /** The detected YouTube subpage. */
    page: PageType;
    /** The current content locale (re-detected on SPA navigation). */
    locale: string;
    /** The current settings (single source of truth). */
    settings: Settings;
}

/**
 * Detects the YouTube SPA page type from a URL, optionally confirmed by a DOM probe.
 *
 * URL patterns (primary): `/watch?v=` → watch, `/feed/subscriptions` → subscriptions,
 * `/results` → search, `/shorts/` → shorts, `/@name`|`/channel/`|`/c/`|`/user/` → channel.
 * Everything else (including `/feed/trending`, `/`) → home. DOM content cues resolve
 * ambiguity: `ytd-rich-grid-renderer` (grid pages only) → home; `ytd-watch-flexy` → watch.
 *
 * ! Pure — no document access. Pass a DomProbe for confirmation, or omit to rely on URL only.
 *
 * @param url - The full YouTube URL.
 * @param dom - Optional DOM probe for confirmation cues.
 * @returns The detected PageType (never "*").
 */
export function detectPage(url: string, dom?: DomProbe): PageType {
    let path: string;
    try {
        path = new URL(url, "https://www.youtube.com").pathname;
    } catch {
        return "home";
    }

    if (path === "/watch" || path.startsWith("/watch")) return "watch";
    if (path === "/feed/subscriptions" || path.startsWith("/feed/subscriptions")) return "subscriptions";
    if (path === "/results" || path.startsWith("/results")) return "search";
    if (path.startsWith("/shorts/")) return "shorts";
    if (path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/")) {
        return "channel";
    }

    // * DOM content cues resolve ambiguity. ! YouTube keeps `ytd-watch-flexy` in the DOM after
    //   navigating AWAY from watch (fast back-nav caching) → a bare presence check would
    //   false-positive "watch" on the homepage (breaking home-only CSS features like feed-chips +
    //   startpage-grid on back-navigation). `ytd-rich-grid-renderer` exists only on grid pages
    //   (removed on watch) → it discriminates home from the lingering watch element. The watch
    //   cue still covers the genuine edge case (URL "/" but actually on watch): there rich-grid
    //   is absent, so it falls through to the watch-flexy check.
    if (dom?.has?.("ytd-rich-grid-renderer")) return "home";
    if (dom?.has?.("ytd-watch-flexy")) return "watch";

    return "home";
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Runtime page-context (side-effectful, wires SPA nav events)
// ─────────────────────────────────────────────────────────────────────────────

let currentCtx: PageCtx | null = null;
const listeners = new Set<(ctx: PageCtx) => void>();

/**
 * Builds a PageCtx snapshot from the current document state (URL + locale + settings).
 *
 * @param settings - The current settings.
 * @returns A fresh PageCtx.
 */
export function buildPageCtx(settings: Settings): PageCtx {
    return {
        page: detectPage(location.href, { has: (sel) => !!document.querySelector(sel) }),
        locale: detectLocale(),
        settings,
    };
}

/**
 * Initializes the page-context module: builds the initial snapshot and registers SPA-navigation
 * listeners (`yt-navigate-finish`, `yt-page-data-updated`, `popstate`) that re-detect the page
 * and locale, then notify subscribers. Call once at boot.
 *
 * @param settings - The initial settings.
 * @param onChange - Optional callback invoked on every page/locale change.
 */
export function initPageContext(settings: Settings, onChange?: (ctx: PageCtx) => void): void {
    currentCtx = buildPageCtx(settings);
    if (onChange) listeners.add(onChange);

    window.addEventListener("yt-navigate-finish", recomputePageCtx);
    window.addEventListener("yt-page-data-updated", recomputePageCtx);
    window.addEventListener("popstate", recomputePageCtx);
}

/**
 * Re-detects page + locale from the current document state and notifies on change.
 *
 * * Registered as the SPA-navigation listener and also called directly at DOMContentLoaded:
 *   document-start may run before `document.documentElement.lang` is set, so the boot snapshot
 *   can hold a wrong locale that only a re-detect at DCL can heal (the wrong locale would feed
 *   every feature dispatch wrong LOCALE_PATTERNS until the first SPA navigation otherwise).
 *
 * ! Settings changes deliberately do NOT notify here: `recompute` snapshots `prev.settings`
 *   (the last-applied reference), while settings mutations flow through `updatePageCtxSettings`
 *   (called by the store on every setByPath/save/reset/import). Notifying from both paths
 *   would double-dispatch; page/locale changes own this path, settings changes own the other.
 */
export function recomputePageCtx(): void {
    if (!currentCtx) return;
    const prev = currentCtx;
    const next = buildPageCtx(prev.settings);
    // * Only notify when page or locale actually changed (avoids redundant re-dispatch).
    if (next.page !== prev.page || next.locale !== prev.locale) {
        currentCtx = next;
        log.debug("page", `pagechange ${prev.page}→${next.page} (locale ${prev.locale}→${next.locale})`);
        for (const cb of listeners) cb(next);
    }
}

/**
 * Returns the current page-context snapshot.
 *
 * @returns The current PageCtx. Throws if called before `initPageContext`.
 * @throws {Error} If initPageContext has not been called.
 */
export function getPageCtx(): PageCtx {
    if (!currentCtx) throw new Error("PageContext not initialized — call initPageContext first");
    return currentCtx;
}

/**
 * Updates the settings reference in the current page-context (without re-detecting page/locale).
 *
 * @param settings - The new settings.
 */
export function updatePageCtxSettings(settings: Settings): void {
    if (currentCtx) currentCtx = { ...currentCtx, settings };
}

/**
 * Subscribes to page/locale changes. The callback is invoked on SPA navigation that changes the
 * page or locale.
 *
 * @param cb - The callback to invoke on change.
 * @returns An unsubscribe function.
 */
export function onPageChange(cb: (ctx: PageCtx) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
