import { mount, unmount } from "svelte";
import App from "../gui/App.svelte";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Settings panel orchestration — lazy mount/unmount of the Svelte app root
// ─────────────────────────────────────────────────────────────────────────────
// * Encapsulates the settings panel lifecycle (mount/unmount) in one place.
// * main.ts (GM_registerMenuCommand) and masthead.ts (settings button click)
// * call into here. Generic app module for future app-wide panel logic.

let app: ReturnType<typeof mount> | null = null;
let appTarget: HTMLDivElement | null = null;

/**
 * Opens (mounts) the settings panel. Idempotent: no-op when already open.
 *
 * Mounts a fresh {@link App} into a new `<div>` appended to `document.body`.
 */
export function openSettings(): void {
    if (app) return;
    // * The panel needs a body to mount into — at @run-at document-start it doesn't exist
    //   yet. All current call sites run post-DCL, but a future caller could hit this early,
    //   so fail loudly instead of crashing on `body.append(undefined)`.
    if (!document.body) {
        console.error("[YT-Tweaks] openSettings: no document.body yet (called before DOMContentLoaded?)");
        return;
    }
    appTarget = document.createElement("div");
    document.body.append(appTarget);
    app = mount(App, {
        target: appTarget,
        props: {
            onClose: closeSettings,
        },
    });
}

/**
 * Closes (unmounts) the settings panel. Idempotent: no-op when not open.
 *
 * Unmounts the Svelte app and removes the host `<div>` from the DOM.
 */
export function closeSettings(): void {
    if (!app || !appTarget) return;
    unmount(app);
    appTarget.remove();
    app = null;
    appTarget = null;
}

/**
 * Reports whether the settings panel is currently open.
 *
 * @returns True if mounted.
 */
export function isSettingsOpen(): boolean {
    return app !== null;
}
