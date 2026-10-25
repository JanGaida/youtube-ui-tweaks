import { store } from "../stores/settings.svelte";
import { currentSettings, startObserver, stopObserver, runAll } from "./observer";
import { applyCSS, STYLE_ID } from "./css";
import { restoreAll } from "./registry";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: System-Toggle — global kill-switch (`system.tweaksEnabled`)
// ─────────────────────────────────────────────────────────────────────────────
// * Migrated from main.ts (legacy separate GM key `ytTweaksEnabled`). Now lives in the settings
//   JSON under `system.tweaksEnabled`. Persisted via `store.save()`.
// * On disable: stops the observer, removes the tweak stylesheet, and restores ALL DOM
//   mutations (registry.restoreAll — covers text/ads/badge/masthead/dim-watched/guide-*).
//   The anonymize layer's `<style id="yt-tweaks-anonymize-css">` is intentionally NOT touched
//   (independent feature — survives kill-switch-off).

/**
 * Reports whether the global kill-switch is currently enabled.
 *
 * Reads from the observer's `currentSettings` ref (synced by the store). Falls back to `true`
 * when the settings aren't loaded yet (safe default — tweaks active until proven otherwise).
 *
 * @returns True when tweaks are enabled.
 */
export function isTweaksEnabled(): boolean {
    return currentSettings?.system.tweaksEnabled ?? true;
}

/**
 * Applies the kill-switch state to the DOM + observer.
 *
 * When `enabled`: re-applies the tweak CSS, restarts the observer, and runs all features.
 * When disabled: stops the observer, removes the tweak stylesheet (`#yt-tweaks-css`), and
 * restores all DOM mutations via `registry.restoreAll` (text-shorten, ads-hide, auto-sync-badge,
 * masthead, dim-watched, guide-styling/visibility/entries). The anonymize layer is NOT affected.
 *
 * Idempotent: re-enabling when already enabled re-applies CSS + restarts (no-op observer start).
 *
 * @param enabled - The new kill-switch state.
 */
export function applyToggleState(enabled: boolean): void {
    if (enabled) {
        // * Re-enable: re-apply CSS, restart observer, run all features.
        if (currentSettings) applyCSS(currentSettings);
        startObserver();
        runAll();
        log.info("system-toggle", "tweaks enabled");
    } else {
        // * Disable: stop observer, remove stylesheet, restore all DOM mutations.
        stopObserver();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
        restoreAll();
        log.info("system-toggle", "tweaks disabled (clean state)");
    }
}

/**
 * Sets the kill-switch state: mutates the store, persists immediately, and applies the effect.
 *
 * `store.save()` is called right away (not deferred to panel-close) so the toggle survives a
 * reload before the panel is closed — the TM-menu path never has a panel-open, so there is no
 * save-on-close fallback there.
 *
 * @param enabled - The new kill-switch state.
 */
export function setTweaksEnabled(enabled: boolean): void {
    store.setByPath("system.tweaksEnabled", enabled);
    store.save();
    applyToggleState(enabled);
}
