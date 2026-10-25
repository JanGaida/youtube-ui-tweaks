import { store } from "../stores/settings.svelte";
import { DEFAULT_SETTINGS } from "./settings";
import { currentSettings } from "./observer";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Anonymize Layer — CSS-only blur over sensitive texts + thumbnails + avatars
// ─────────────────────────────────────────────────────────────────────────────
// * Independent module (NOT in the FeatureRegistry). Own `<style>` element, own toggle handler.
// * Pure CSS: `filter: blur()` on sensitive text + image selectors. No DOM mutation, no
//   placeholder replacement. Reversible (remove the `<style>` to undo).
// * Independent of the global kill-switch (`system.tweaksEnabled`): when the kill-switch is off,
//   `applyToggleState(false)` removes `#yt-tweaks-css` but NOT `#yt-tweaks-anonymize-css`
//   (the anonymize layer is a separate utility, not a "tweak" that needs restoring).
// * Blur strength is configurable via `system.anonymizeBlur` (px). Images get 1.5x the text
//   blur (faces/video frames need more to be unrecognizable).
// * Selectors are scoped to avoid blurring UI controls (buttons, navigation). Verified against
//   the captured fixtures (home-grid-item, watch-recommendations, masthead, guide-full).
//
//   TEXT (gets blur as-is):
//   - `.ytLockupViewModelMetadata` — title + meta + avatar container in grid items
//     (home/subscriptions/channel/search/watch-recommendations).
//   - `ytd-channel-name` — channel name on watch-page comments + channel pages.
//   - `ytd-comment-renderer #content-text` — comment text.
//
//   IMAGES (get 1.5x blur — faces/video need more):
//   - `.ytThumbnailViewModelImage` — video thumbnails in grid items + watch recommendations.
//   - `.ytLockupMetadataViewModelAvatar` — avatar in grid items.
//   - `#avatar yt-img-shadow` — logged-in user's avatar in the masthead (scoped via #avatar
//     ancestor — bare `yt-img-shadow` would also blur guide sidebar entry icons).
//   - `ytd-comment-renderer yt-img-shadow` — comment author avatars (scoped to comment renderer).
//   - `#movie_player video` — the watch-page video player frame (the actual playing video).
//     Scoped to the player — does NOT blur thumbnails or other video elements.

/** DOM id of the injected `<style>` element holding the anonymize-layer CSS. */
export const ANON_STYLE_ID = "yt-tweaks-anonymize-css";

/** Image blur multiplier — images get 1.5x the text blur (faces/video need more). */
const IMAGE_BLUR_FACTOR = 1.5;

/**
 * Generates the anonymize-layer CSS — blur on sensitive text + image selectors.
 *
 * All rules use `!important` to override YouTube's own styles. Selectors are scoped to avoid
 * blurring UI controls (buttons, navigation, guide icons). Image selectors get 1.5x the text
 * blur (`IMAGE_BLUR_FACTOR`).
 *
 * @param blur - The base blur radius in px (applied to text; images get 1.5x). Must be >= 0.
 * @returns A newline-joined CSS string. Empty when `blur <= 0` (nothing to blur).
 */
export function generateAnonymizeCSS(blur: number): string {
    if (blur <= 0) return "";
    const textBlur = blur;
    const imageBlur = Math.round(blur * IMAGE_BLUR_FACTOR);
    const rules = [
        // ── TEXT (blur as-is) ──
        // * Grid-item metadata (title + meta + avatar container).
        `.ytLockupViewModelMetadata { filter: blur(${textBlur}px) !important; }`,
        // * Channel name on watch-page comments + channel pages.
        `ytd-channel-name { filter: blur(${textBlur}px) !important; }`,
        // * Comment text (#content-text inside the comment renderer).
        `ytd-comment-renderer #content-text { filter: blur(${textBlur}px) !important; }`,
        // ── IMAGES (1.5x blur — faces/video need more) ──
        // * Video thumbnails in grid items + watch recommendations.
        `.ytThumbnailViewModelImage { filter: blur(${imageBlur}px) !important; }`,
        // * Avatar image in grid items.
        `.ytLockupMetadataViewModelAvatar { filter: blur(${imageBlur}px) !important; }`,
        // * Logged-in user's avatar in the masthead (scoped via #avatar ancestor).
        `#avatar yt-img-shadow { filter: blur(${imageBlur}px) !important; }`,
        // * Comment author avatars (scoped to the comment renderer, not the guide).
        `ytd-comment-renderer yt-img-shadow { filter: blur(${imageBlur}px) !important; }`,
        // * The watch-page video player frame (the actual playing video). Scoped to #movie_player.
        `#movie_player video { filter: blur(${imageBlur}px) !important; }`,
    ];
    return rules.join("\n");
}

/**
 * Applies or removes the anonymize layer by mounting/removing its `<style>` element.
 *
 * Reads the current blur strength from `currentSettings.system.anonymizeBlur` (curated
 * default via DEFAULT_SETTINGS — ADR 0007).
 * Safe at `document-start`: falls back to `document.documentElement` when `document.head` is
 * absent (same pattern as `css.ts`). Uses `textContent` (Trusted-Types-safe).
 *
 * Idempotent: enabling when the style already present updates its content (so blur-strength
 * changes re-mount with the new value); disabling when already removed is a no-op.
 *
 * @param enabled - True to mount the anonymize `<style>`, false to remove it.
 */
export function applyAnonymize(enabled: boolean): void {
    const id = ANON_STYLE_ID;
    if (enabled) {
        // * Fallback mirrors the DEFAULT_SETTINGS value — read the default from there so the
        //   two can never drift apart when the default blur changes.
        const blur = currentSettings?.system.anonymizeBlur ?? DEFAULT_SETTINGS.system.anonymizeBlur;
        const css = generateAnonymizeCSS(blur);
        let el = document.getElementById(id) as HTMLStyleElement | null;
        if (el) {
            el.textContent = css;
        } else {
            el = document.createElement("style");
            el.id = id;
            el.textContent = css;
            // ! document.head may be null at document-start → documentElement fallback
            const mount = document.head || document.documentElement;
            if (!mount) {
                log.error("anonymize", "no mount point (document.head & documentElement null)");
                return;
            }
            mount.appendChild(el);
        }
        log.info("anonymize", `anonymize layer enabled (blur ${blur}px)`);
    } else {
        const el = document.getElementById(id);
        if (el) el.remove();
        log.info("anonymize", "anonymize layer disabled");
    }
}

/**
 * Reports whether the anonymize layer is currently enabled.
 *
 * Reads from the observer's `currentSettings` ref (synced by the store). Falls back to `false`
 * when settings aren't loaded yet.
 *
 * @returns True when the anonymize layer is enabled.
 */
export function isAnonymizeEnabled(): boolean {
    return currentSettings?.system.anonymize ?? false;
}

/**
 * Sets the anonymize-layer state: mutates the store, persists immediately, and applies the effect.
 *
 * `store.save()` is called right away (not deferred to panel-close) so the toggle survives a
 * reload before the panel is closed — the TM-menu path never has a panel-open.
 *
 * @param enabled - The new anonymize-layer state.
 */
export function setAnonymize(enabled: boolean): void {
    store.setByPath("system.anonymize", enabled);
    store.save();
    applyAnonymize(enabled);
}
