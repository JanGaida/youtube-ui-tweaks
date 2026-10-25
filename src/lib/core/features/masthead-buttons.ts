import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import { hideMasthead, restoreMasthead } from "../masthead";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: masthead-buttons feature — custom topbar buttons + empty-notification hide (DOM)
// ─────────────────────────────────────────────────────────────────────────────
// * JS mutation: injects custom buttons (history/subscriptions/playlists/etc.) into separate
//   left/right bars, and hides the notification bell when empty. Applies globally (masthead is
//   on every page). Idempotent via a hash over button positions + spacings.

/**
 * Runs the masthead-buttons DOM pass (delegates to masthead.ts).
 *
 * @param ctx - The page context (settings + content locale for the button labels).
 */
function mastheadButtonsRun(ctx: PageCtx): void {
    hideMasthead(ctx.settings, ctx.locale);
}

/**
 * Masthead-buttons feature: custom topbar buttons + empty-notification hiding (DOM pass).
 *
 * * DOM-Fixture: __fixtures__/masthead.fixture.html (captured 2026-08-10 — injection points #container/#center/#end present; DOM run manually verified). Shadow-DOM-Grenze: ytd-masthead internals (buttons are inserted as light-DOM siblings of #start/#center/#end, not inside shadow).
 * ~ DECISION-LOG: separate left/right bars inserted as flex-children of #container (NOT inside
 *   #start/#buttons) — avoids Create-button conflict + Polymer re-render loops. Align via
 *   margin auto-trick to pull the bar toward the desired neighbor against #container's
 *   space-between. Idempotency via hash to prevent re-inject loops on SPA nav.
 */
export const mastheadButtonsFeature: Feature = {
    id: "masthead-buttons",
    settingsPath: "styling.masthead",
    pages: {
        "*": { run: mastheadButtonsRun, restore: restoreMasthead },
    },
    liveApplyKeys: [
        "styling.masthead.enabled",
        "styling.masthead.hideNotification",
        "styling.masthead.historyButton",
        "styling.masthead.subscriptionsButton",
        "styling.masthead.playlistsButton",
        "styling.masthead.watchLaterButton",
        "styling.masthead.likedVideosButton",
        "styling.masthead.myVideosButton",
        "styling.masthead.downloadsButton",
        "styling.masthead.settingsButton",
        "styling.masthead.buttonOrder",
        "styling.masthead.logoSpacing",
        "styling.masthead.buttonSpacing",
        "styling.masthead.rightSpacing",
        "styling.masthead.leftBarAlign",
        "styling.masthead.rightBarAlign",
    ],
};
