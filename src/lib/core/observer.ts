import type { Settings } from "./settings";
import type { PageCtx } from "./page";
import { getPageCtx, updatePageCtxSettings, buildPageCtx } from "./page";
import {
    runAll as registryRunAll,
    generateCSS as registryGenerateCSS,
    scheduleLiveApply as registryScheduleLiveApply,
    flushLiveApply as registryFlushLiveApply,
    restoreAll as registryRestoreAll,
} from "./registry";
import log, { isDebugEnabled } from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Observer — thin dispatcher over the FeatureRegistry + PageContext
// ─────────────────────────────────────────────────────────────────────────────
// * Replaces the hardcoded runOnce body and live-apply key switch with registry dispatch.
//   runAll() builds a PageCtx from the current settings + page, then delegates to
//   registry.runAll. scheduleLiveApply delegates to registry.scheduleLiveApply (key-driven
//   restore via feature liveApplyKeys). The legacy currentSettings/currentLocale refs are kept
//   for the Debug-tab status display and store sync.

/** Mutable ref holding the current settings; updated by the store, read for status display. */
export let currentSettings: Settings | null = null;
/** Mutable ref holding the current content locale; kept in sync with the PageContext. */
export let currentLocale = "de";

/** Updates the observer's current-settings reference and the PageContext settings. */
export function setCurrentSettings(s: Settings): void {
    currentSettings = s;
    updatePageCtxSettings(s);
}

/** Updates the observer's current-locale reference (display only — PageContext owns the truth). */
export function setCurrentLocale(l: string): void {
    currentLocale = l;
}

let observer: MutationObserver | null = null;

/**
 * Reports whether the MutationObserver is currently observing.
 *
 * @returns True if the observer is running.
 */
export function isObserverRunning(): boolean {
    return observer !== null;
}

// * requestIdleCallback with setTimeout fallback — runs when idle, never blocks rendering.
function runIdle(fn: () => void): void {
    if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 300 });
    else setTimeout(fn, 100);
}

// * Throttle with leading+trailing edge and max-wait. A pure trailing debounce would never fire
//   during continuous scrolling, leaving lazy-loaded promo shelves visible.
// * Module-level timer state (not a closure) so stopObserver() can cancel a pending
//   trailing-edge pass — otherwise a mutation queued just before the kill-switch flips
//   re-mutates the DOM AFTER restoreAll().
const THROTTLE_MS = 200;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;
let lastRun = 0;
const runOnce = (): void => {
    runIdle(() => {
        // * Kill-switch gate: a pass scheduled before setTweaksEnabled(false) must not fire
        //   after stopObserver() + restoreAll() and re-mutate the "clean" DOM.
        if (!currentSettings || currentSettings.system.tweaksEnabled === false) return;
        runAll();
    });
};
function throttledRunAll(): void {
    if (!document.body) return;
    const now = Date.now();
    const remaining = THROTTLE_MS - (now - lastRun);
    if (remaining <= 0) {
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }
        lastRun = now;
        runOnce();
    } else if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
            throttleTimer = null;
            lastRun = Date.now();
            runOnce();
        }, remaining);
    }
}

/**
 * Starts the MutationObserver on `#content` (falling back to `documentElement`) and registers
 * the `yt-navigate-finish` SPA listener. No-op if already running.
 */
export function startObserver(): void {
    if (observer) return;
    const target = document.querySelector("#content") || document.documentElement;
    observer = new MutationObserver(() => throttledRunAll());
    observer.observe(target, { childList: true, subtree: true, attributes: false });
    // ! yt-navigate-finish bonus (observer is primary)
    window.addEventListener("yt-navigate-finish", throttledRunAll);
    log.debug("obs", `observer started on ${target.id ? "#" + target.id : "documentElement"}`);
}

/** Stops the observer, removes the SPA navigation listener, and cancels any pending pass. */
export function stopObserver(): void {
    if (observer) {
        observer.disconnect();
        observer = null;
        window.removeEventListener("yt-navigate-finish", throttledRunAll);
    }
    // * Cancel the pending trailing-edge throttle pass too (see throttledRunAll) — runOnce's
    //   kill-switch gate covers the in-flight requestIdleCallback as a second line of defense.
    if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
    }
}

/**
 * Runs one full registry dispatch pass against the current page context. Logs timing and the
 * tweak-marker counts for status display.
 *
 * ! Gated on `system.tweaksEnabled` as a defense-in-depth: scheduled callers (throttle, idle
 *   callback, live-apply timers) may race the kill-switch toggle.
 */
export function runAll(): void {
    if (!document.body) {
        log.warn("run", "no document.body — skipping");
        return;
    }
    if (!currentSettings) return;
    if (currentSettings.system.tweaksEnabled === false) {
        log.debug("run", "tweaks disabled — skipping runAll");
        return;
    }
    let ctx: PageCtx;
    try {
        ctx = getPageCtx();
    } catch {
        // * PageContext not initialized yet (early boot) — build an ad-hoc ctx.
        ctx = buildPageCtx(currentSettings);
    }
    const runCtx = { ...ctx, settings: currentSettings };
    const t0 = isDebugEnabled() ? performance.now() : 0;
    registryRunAll(runCtx);
    // * Debug-status queries (marker counts) run ONLY in debug mode — two full-document
    //   querySelectorAll per observer tick are pure overhead at info level.
    if (isDebugEnabled()) {
        const textCount = document.querySelectorAll('[data-yt-tweaked="1"]').length;
        const hiddenCount = document.querySelectorAll("[data-yt-tweaks-hidden]").length;
        log.debug("run", `done in ${(performance.now() - t0).toFixed(1)}ms`, {
            page: runCtx.page,
            textShortened: textCount,
            adsHidden: hiddenCount,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Live-Apply — CSS + selective restore+rerun via registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies all live-updatable effects (CSS) immediately for the given settings via the registry.
 *
 * @param settings - The current settings.
 */
export function applyAllLive(settings: Settings): void {
    let ctx: PageCtx;
    try {
        ctx = getPageCtx();
    } catch {
        ctx = buildPageCtx(settings);
    }
    const liveCtx = { ...ctx, settings };
    applyCSSFromRegistry(liveCtx);
}

/**
 * Restores every feature's DOM mutation, then re-applies CSS + re-runs all features.
 *
 * ! Conservative whole-state reset (used after settings reset/import): there is no per-key
 *   diff for a wholesale settings replacement, so everything is restored and re-applied from
 *   scratch. Rare operation (explicit user action) — the brief flicker is acceptable.
 *
 * @param settings - The settings now in effect.
 */
export function restoreAndRunAll(settings: Settings): void {
    registryRestoreAll();
    applyAllLive(settings);
    runAll();
}

/** Generates CSS via the registry and injects it via applyCSS. */
function applyCSSFromRegistry(ctx: PageCtx): void {
    const css = registryGenerateCSS(ctx.settings, ctx);
    // * applyCSS expects a Settings arg and generates internally; we bypass by calling the
    //   injector directly with the registry-produced string.
    injectCSS(css);
}

/**
 * Schedules a debounced live-apply via the registry (key-driven restore over feature
 * liveApplyKeys), then re-runs all features and re-applies CSS.
 *
 * @param settings   - The current settings.
 * @param changedKey - Optional dot-path of the changed key.
 */
export function scheduleLiveApply(settings: Settings, changedKey?: string): void {
    if (!changedKey) {
        applyAllLive(settings);
        return;
    }
    let ctx: PageCtx;
    try {
        ctx = getPageCtx();
    } catch {
        ctx = buildPageCtx(settings);
    }
    registryScheduleLiveApply(settings, changedKey, ctx, (css) => injectCSS(css));
}

/** Flushes any pending debounced live-apply immediately (used on save/import). */
export function flushLiveApply(): void {
    if (!currentSettings) return;
    let ctx: PageCtx;
    try {
        ctx = getPageCtx();
    } catch {
        ctx = buildPageCtx(currentSettings);
    }
    registryFlushLiveApply(currentSettings, ctx, (css) => injectCSS(css));
}

/**
 * Injects (or updates) the tweak stylesheet with the given CSS string.
 *
 * @param css - The CSS string to inject.
 */
function injectCSS(css: string): void {
    let el = document.getElementById("yt-tweaks-css") as HTMLStyleElement | null;
    if (el) {
        el.textContent = css;
        return;
    }
    el = document.createElement("style");
    el.id = "yt-tweaks-css";
    el.textContent = css;
    const mount = document.head || document.documentElement;
    if (!mount) {
        log.error("css", "no mount point (document.head & documentElement null)");
        return;
    }
    mount.appendChild(el);
}
