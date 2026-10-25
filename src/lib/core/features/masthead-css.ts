import type { Feature } from "../feature.types";
import type { MastheadSettings } from "../settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: masthead-css feature — topbar CSS (buttons, search, notifications)
// ─────────────────────────────────────────────────────────────────────────────
// * Pure CSS for the masthead (topbar): hide create/mic/menu/notification, search-button hide +
//   input re-rounding, search-bar width, right-bar align. Applies on all pages (masthead is
//   global). Independent of the grid-styling toggle.

/**
 * Builds the masthead CSS rules from the masthead settings slice.
 *
 * @param slice - The masthead settings slice (MastheadSettings).
 * @returns CSS rule strings.
 */
function mastheadCss(slice: unknown): string[] {
    const m = slice as MastheadSettings;
    if (!m.enabled) return [];
    const rules: string[] = [];
    if (m.hideCreateButton) {
        rules.push(`ytd-masthead #buttons > ytd-button-renderer:first-child { display: none !important; }`);
    }
    if (m.hideMicButton) {
        rules.push(`ytd-masthead #voice-search-button { display: none !important; }`);
    }
    if (m.hideSearchButton) {
        rules.push(
            `ytd-masthead .ytSearchboxComponentSearchButton, ytd-masthead #search-button-narrow { display: none !important; }`,
            `ytd-masthead .ytSearchboxComponentInputBox { border-top-right-radius: 40px !important; border-bottom-right-radius: 40px !important; border-right-width: 1px !important; }`,
            `ytd-masthead .ytSearchboxComponentInputContainer { border-top-right-radius: 40px !important; border-bottom-right-radius: 40px !important; }`,
        );
    }
    if (m.hideHamburger) {
        // * Hamburger-Icon (3-Linien Menu-Button) verbergen — nur das Icon, NICHT die Guide-Pane.
        //   Die Guide-Sidebar-Sichtbarkeit wird in der guide-Gruppe gesteuert (guide-visibility feature).
        rules.push(`ytd-masthead #guide-button { display: none !important; }`);
    }
    if (m.rightBarAlign === "buttons") {
        rules.push(`ytd-masthead #end { min-width: 0 !important; }`);
    }
    if (m.hideNotification === "always") {
        rules.push(`ytd-masthead ytd-notification-topbar-button-renderer { display: none !important; }`);
    }
    if (m.searchWidthPct > 0) {
        rules.push(
            `ytd-masthead #center { justify-content: center !important; }`,
            `ytd-masthead #center yt-searchbox { flex: 0 0 ${m.searchWidthPct}vw !important; margin: 0 auto !important; }`,
        );
    }
    // * Hover-Opacity: gesamte Toprow (#container incl. #start/#center/#end + Custom-Bars) im
    //   Idle-Zustand dimmen, bei Hover/Focus-within → 100%. Intent-basierter Trigger
    //   (ytd-masthead:hover, ytd-masthead:focus-within), nicht erst am einzelnen Element.
    //   toprowOpacityIdle=100 (Default) → keine Regel (keine Regression zum bisherigen Verhalten).
    if (m.toprowOpacityIdle < 100) {
        const idle = m.toprowOpacityIdle / 100;
        const transition = m.toprowAnimSpeed > 0 ? `opacity ${m.toprowAnimSpeed}ms ease` : "none";
        rules.push(
            `ytd-masthead #container { opacity: ${idle} !important; transition: ${transition} !important; }`,
            `ytd-masthead:hover #container, ytd-masthead:focus-within #container { opacity: 1 !important; }`,
        );
    }
    return rules;
}

/**
 * Masthead-css feature: topbar CSS (buttons, search, notifications) — global (`*`).
 *
 * * DOM-Fixture: __fixtures__/masthead.fixture.html (captured 2026-08-10 — probe-counts cover #container/#start/#center/#end; CSS selectors manually verified against fixture).
 * ~ DECISION-LOG: search-button hide also re-rounds the input box right edge + container (YT
 *   would otherwise leave a flat cut where the button was). rightBarAlign=buttons clears
 *   #end min-width so the custom right bar hugs Create/Avatar (YT sets min-width:225px).
 */
export const mastheadCssFeature: Feature = {
    id: "masthead-css",
    settingsPath: "styling.masthead",
    pages: {
        "*": { css: mastheadCss },
    },
    liveApplyKeys: [
        "styling.masthead.enabled",
        "styling.masthead.hideCreateButton",
        "styling.masthead.hideMicButton",
        "styling.masthead.hideSearchButton",
        "styling.masthead.searchWidthPct",
        "styling.masthead.hideNotification",
        "styling.masthead.hideHamburger",
        "styling.masthead.rightBarAlign",
        "styling.masthead.toprowOpacityIdle",
        "styling.masthead.toprowAnimSpeed",
        "styling.masthead.buttonOrder",
    ],
};
