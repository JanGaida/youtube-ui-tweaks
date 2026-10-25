import type { Settings } from "./settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: meta-split — dedicated metadata line for views + date (break-element pass)
// ─────────────────────────────────────────────────────────────────────────────
// * metaLayout:"split" (analysis 2026-10-24): YouTube renders channel names +
//   views + date in ONE inline metadata row — long names push views/date into
//   ragged wraps (Fall 1) and multi-channel rows glue/over-space items via empty
//   delimiters (Fall 2). The pass inserts ONE break element before the views
//   unit: line 1 = channel names + verified icon (inline flow, follows metaAlign),
//   line 2 = views + date (dedicated, consistently positioned across all items).
//
// * Anchor (bug #11 rationale — structural selectors lie, markers don't): the
//   native leading icon (.ytContentMetadataViewModelLeadingIcon — structural,
//   exists on grid lockups even before the text pass) is primary; the views
//   marker ([data-yt-tweaks-views]) is the fallback. grid-styling registers BEFORE
//   text-shorten, so markers may not exist yet on the first pass — the structural
//   anchor keeps the split stable. No anchor → row stays mixed (graceful).
//
// * NO node moves — the split is one inserted element + CSS (ADR 0001 marker
//   pattern): restore removes all break elements, re-runs re-insert. The CSS side
//   (break box, views gap, delimiter displacement) lives in grid-styling.ts.

/** Class on the inserted break element (restore removes all of them). */
export const ROWBREAK_CLASS = "yt-tweaks-rowbreak";

/** Selector matching lockup metadata rows on grid pages (badge wrap rows filtered in-pass). */
const ROW_SELECTOR = ".ytLockupMetadataViewModelMetadata .ytContentMetadataViewModelMetadataRow";

/** Anchor candidates for the line break, in priority order (leading icon → views marker). */
const ANCHOR_SELECTOR = ".ytContentMetadataViewModelLeadingIcon, [data-yt-tweaks-views]";

/** True when the split pass should run per the styling slice. */
function isSplitEnabled(settings: Settings): boolean {
    return settings.styling.enabled && settings.styling.metaLayout === "split";
}

/**
 * Inserts one break element before the views unit of every metadata row.
 *
 * Idempotent per row: a row that already contains a break is skipped. Badge wrap rows
 * (their own metadata row) and rows without an anchor are left untouched. A break
 * before the first child would only add an empty zero-height line — skipped as well.
 *
 * @param settings - The current settings.
 */
export function runMetaSplit(settings: Settings): void {
    if (!isSplitEnabled(settings)) return;
    document.querySelectorAll<HTMLElement>(ROW_SELECTOR).forEach((row) => {
        if (row.classList.contains("ytContentMetadataViewModelMetadataRowMetadataRowWrap")) return;
        if (row.querySelector(`.${ROWBREAK_CLASS}`)) return;
        const anchor = row.querySelector<HTMLElement>(ANCHOR_SELECTOR);
        if (!anchor) return;
        if (anchor === row.firstElementChild) return;
        const brk = document.createElement("span");
        brk.className = ROWBREAK_CLASS;
        brk.setAttribute("aria-hidden", "true");
        row.insertBefore(brk, anchor);
    });
}

/** Removes all inserted break elements (live-apply / kill-switch restore). */
export function restoreMetaSplit(): void {
    document.querySelectorAll(`.${ROWBREAK_CLASS}`).forEach((el) => el.remove());
}
