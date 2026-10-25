// ─────────────────────────────────────────────────────────────────────────────
// MARK: chip-layout — shared stack-layout CSS for YouTube chip bars
// ─────────────────────────────────────────────────────────────────────────────
// * Pure-CSS override that replaces YouTube's horizontal carousel chip bar with a wrapping flex
//   list. Used by both feed-chips (home) and watch-chips (watch-page related sidebar). The inner
//   IDs (`#scroll-container`, `#chips`, `#left-arrow`, `#right-arrow`) are identical across both
//   bars — only the outer bar container + the flex-row element differ:
//     - Home:     bar = `ytd-feed-filter-chip-bar-renderer`, row = `#chips-content`
//     - Watch:    bar = `yt-related-chip-cloud-renderer yt-chip-cloud-renderer`, row = `#container`
//   The chips themselves (`yt-chip-cloud-chip-renderer`) are the same element on both pages.
//
// * YT-native carousel (verified via live-DOM dumps 2026-08-28, both pages): the flex-row element
//   (flex row, relative) holds `#scroll-container` (fixed width, `overflow:hidden`,
//   `white-space:nowrap`) which clips the wider `#chips` row (`inline-block`, `white-space:nowrap`,
//   inline `transform:translateX()`). `#left-arrow`/`#right-arrow` are `position:absolute`,
//   toggled via `display` (set by YT from the `at-start`/`at-end` attributes).
//
// * Stack override (dense, not one-per-line): `#chips` becomes `display:flex; flex-wrap:wrap` so
//   chips flow left→right and wrap to the next line only when the row is full — multiple chips
//   per line when they fit. `!important` beats YT's inline `transform` + `nowrap`.

/** Chip custom-element selector (shared by both chip-bar features). */
export const CHIP_SEL = "yt-chip-cloud-chip-renderer";

/** Options for the stack-layout CSS builder. */
export interface StackLayoutOpts {
    /** The bar-container selector prefix (e.g. `ytd-feed-filter-chip-bar-renderer`). */
    bar: string;
    /** The flex-row element that holds the arrows + scroll-container (e.g. `#chips-content`). */
    row: string;
}

/**
 * Builds the stack-layout CSS rules for a chip bar.
 *
 * @param opts - The bar + row selectors identifying the chip-bar structure.
 * @returns CSS rule strings for the stack layout.
 */
export function stackLayoutCss(opts: StackLayoutOpts): string[] {
    const { bar, row } = opts;
    return [
        // * Bar height: YT pins the carousel bar to a fixed 1-line height (e.g. 56px on home);
        //   when chips wrap the taller content overflows (overflow:visible) and overlaps the grid
        //   below. Force height:auto so the bar grows with its wrapped content.
        `${bar} { height:auto !important; }`,
        `${bar} ${row} { flex-direction:column !important; }`,
        `${bar} #scroll-container { overflow:visible !important; height:auto !important; white-space:normal !important; }`,
        `${bar} #chips { transform:none !important; white-space:normal !important; display:flex !important; flex-wrap:wrap !important; }`,
        `${bar} #left-arrow, ${bar} #right-arrow { display:none !important; }`,
        // * Dense spacing: YT's chip margin (0 8px 8px 0) is sized for the single-row carousel;
        //   in the wrapped list it makes rows too airy. Tighten to 0 4px 4px 0.
        `${bar} ${CHIP_SEL} { margin: 0 4px 4px 0 !important; }`,
    ];
}
