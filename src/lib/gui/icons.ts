// ─────────────────────────────────────────────────────────────────────────────
// MARK: GUI icons — SVG paths as strings (Feather-style, B/W via currentColor)
// ─────────────────────────────────────────────────────────────────────────────
// * Rendered in Svelte as a declarative <Icon path={...} /> component (no {@html}
//   due to YouTube's Trusted-Types CSP). 24x24 viewBox, stroke.

/** Stroke-style SVG path strings for the 9 navigation categories (Feather-style, 24x24). */
export const CAT_ICONS: Record<string, string> = {
    // * Video-Item — play-in-rectangle (represents a video card)
    "video-item": "M3 3h18v18H3z M10 8.5v7l6-3.5z",
    // * Menubar — horizontal bar with menu lines (represents the topbar)
    menubar: "M3 5h18 M3 12h18 M3 19h18",
    // * Guide-Sidebar — left sidebar pane (vertical rectangle on left + menu lines)
    "guide-sidebar": "M3 3h6v18H3z M13 8h8 M13 12h8 M13 16h8",
    // * Feed-Chips — rounded chip bar (three pill-shaped chips in a row)
    "feed-chips":
        "M5 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M19 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
    // * Startpage — grid of video cards (home feed layout)
    startpage: "M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18",
    // * Watch-Page — play triangle in a rectangle (watch/playback context)
    "watch-page": "M2 5h20v14H2z M10 9l5 3-5 3z",
    // * Ads & Promotions — block/banner (eye-off-style shield)
    "ads-promotions":
        "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22",
    // * System — gear/settings
    system: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    // * About — info circle
    about: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01",
};

/** Stroke-style SVG path strings for subsection icons + iconbar actions (GitHub logo is filled). */
export const SUB_ICONS: Record<string, string> = {
    // * Action icons (iconbar): stroke-style for reset/export/import; GitHub = filled.
    reset: "M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5",
    export: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    import: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
    // * GitHub logo (filled). Source: user-provided SVG, path extracted.
    github: "M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31C6.73,19.91,6.14,18,6.14,18A2.69,2.69,0,0,0,5,16.5c-.91-.62.07-.6.07-.6a2.1,2.1,0,0,1,1.53,1,2.15,2.15,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34C8,16.17,5.62,15.31,5.62,11.5a3.87,3.87,0,0,1,1-2.71,3.58,3.58,0,0,1,.1-2.64s.84-.27,2.75,1a9.63,9.63,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.58,3.58,0,0,1,.1,2.64,3.87,3.87,0,0,1,1,2.71c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.69,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z",
};

/** Chevron path used by accordion/group toggles. */
export const CHEVRON_PATH = "M9 18l6-6-6-6";

/** External-link arrow (Feather "external-link") for links that open in a new tab. */
export const EXTERNAL_ICON = "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3";
