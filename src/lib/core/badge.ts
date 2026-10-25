import type { Settings, AutoSyncBadgeSettings } from "./settings";
import { ROWBREAK_CLASS } from "./meta-split";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Auto-sync badge — DOM manipulation of the metadata badges
// ─────────────────────────────────────────────────────────────────────────────
// * The badge ("Automatisch synchronisiert"/"Auto-synced") sits in its own
//   metadata-row (.ytContentMetadataViewModelMetadataRowMetadataRowWrap).
//   Modes: original (as-is) | hidden | integrated-start | integrated-end.
//
// * integrated: NO custom span-wrap. Instead reproduce YT's structure 1:1:
//   - Icon = the original .ytBadgeShapeIcon element (clone) — inherits YT fill/color/spacing
//   - Divider = the original .ytContentMetadataViewModelDelimiter (clone) — 1:1 YT separator
//   Both inserted directly into the views/date row (same level as the meta texts).
//
// * Restore: badge row visible + cloned icon/divider removed (marker).
//   Marker via attribute data-yt-tweaks-badge-moved (value = mode) + class on clones.

/** Selector for the metadata-badge row holding the auto-sync badge per grid item. */
export const BADGE_ROW_SELECTOR =
    ".ytContentMetadataViewModelMetadataRow.ytContentMetadataViewModelMetadataRowMetadataRowWrap";

const TWEAKS_MARKER_ATTR = "data-yt-tweaks-badge-moved";
// * Class on all inserted clones (icon + divider) — for restore.
const TWEAKS_CLONE_CLASS = "yt-tweaks-badge-clone";

function getMetadataContainer(badgeRow: Element): HTMLElement | null {
    return badgeRow.closest(".ytLockupMetadataViewModelMetadata") as HTMLElement | null;
}

// * views/date row = first row with a delimiter (views•date), fallback: second row.
function getViewsRow(container: HTMLElement): HTMLElement | null {
    const rows = container.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataRow");
    for (const r of rows) {
        if (r.classList.contains("ytContentMetadataViewModelMetadataRowMetadataRowWrap")) continue;
        if (r.querySelector(".ytContentMetadataViewModelDelimiter")) return r;
    }
    const candidates = Array.from(rows).filter(
        (r) => !r.classList.contains("ytContentMetadataViewModelMetadataRowMetadataRowWrap"),
    );
    return candidates[1] ?? candidates[0] ?? null;
}

// * Clone the original .ytBadgeShapeIcon (div+svg) — 1:1 YT structure, inherits styling.
function cloneIconNode(badgeRow: Element): HTMLElement | null {
    const icon = badgeRow.querySelector(".ytBadgeShapeIcon");
    if (!icon) return null;
    const clone = icon.cloneNode(true) as HTMLElement;
    clone.classList.add(TWEAKS_CLONE_CLASS);
    return clone;
}

// * Clone the original .ytContentMetadataViewModelDelimiter from the views row —
//   1:1 YT separator (•  including spacing/aria-hidden). Custom divider text via setting.
function cloneDividerNode(viewsRow: HTMLElement, customText: string): HTMLElement | null {
    const orig = viewsRow.querySelector(".ytContentMetadataViewModelDelimiter");
    if (!orig) return null;
    const clone = orig.cloneNode(true) as HTMLElement;
    if (customText) clone.textContent = customText;
    clone.classList.add(TWEAKS_CLONE_CLASS);
    return clone;
}

// * Icon size: the inner div of .ytBadgeShapeIcon has inline width/height (24px).
//   Override to em — the svg inside fills 100%.
function setIconSize(iconNode: HTMLElement, iconSizeEm: number): void {
    const inner = iconNode.firstElementChild as HTMLElement | null;
    if (inner) {
        inner.style.width = `${iconSizeEm}em`;
        inner.style.height = `${iconSizeEm}em`;
    }
}

function processBadgeItem(badgeRow: HTMLElement, cfg: AutoSyncBadgeSettings): void {
    if (badgeRow.hasAttribute(TWEAKS_MARKER_ATTR)) return;
    // * original: nothing.
    if (cfg.mode === "original") return;

    // * hidden: inline display:none !important at the element level — beats any
    //   stylesheet (YT's block + metaAlign block, both !important with the same
    //   specificity → stylesheet collision). Inline !important = highest priority.
    if (cfg.mode === "hidden") {
        badgeRow.style.setProperty("display", "none", "important");
        badgeRow.setAttribute(TWEAKS_MARKER_ATTR, "hidden");
        return;
    }

    // * integrated-start / integrated-end — DOM move required.
    badgeRow.style.setProperty("display", "none", "important");

    const container = getMetadataContainer(badgeRow);
    const viewsRow = container ? getViewsRow(container) : null;
    const iconNode = viewsRow ? cloneIconNode(badgeRow) : null;
    const dividerNode = viewsRow ? cloneDividerNode(viewsRow, cfg.divider) : null;
    if (!container || !viewsRow || !iconNode || !dividerNode) {
        // * Failure path (views row not rendered yet — lazy metadata): do NOT set the marker
        //   and do NOT keep the row hidden. The marker would make every later observer pass
        //   skip this row forever while it stays inline-hidden with no clone inserted.
        //   Leaving the row untouched lets the next pass retry the whole move.
        badgeRow.style.removeProperty("display");
        log.debug("badge", "skip icon-move — missing container/viewsRow/icon/divider (retry on next pass)");
        return;
    }

    setIconSize(iconNode, cfg.iconSizeEm);

    // * Order exactly like YT's views•date:
    //   integrated-start = icon, divider  → before the views texts
    //   integrated-end   = divider, icon  → after the views texts
    // ! metaLayout:"split" (meta-split.ts) ends line 1 at the rowbreak element — the
    //   integrated-start clone must land AFTER it (start of the views+date line); the
    //   row start would sit on the channel-name line. Without a break, the row start IS
    //   the views position (mixed layout, native behavior unchanged).
    if (cfg.mode === "integrated-start") {
        const brk = viewsRow.querySelector(`.${ROWBREAK_CLASS}`);
        const ref = brk ? brk.nextSibling : viewsRow.firstChild;
        viewsRow.insertBefore(dividerNode, ref);
        viewsRow.insertBefore(iconNode, dividerNode);
    } else {
        viewsRow.appendChild(dividerNode);
        viewsRow.appendChild(iconNode);
    }

    badgeRow.setAttribute(TWEAKS_MARKER_ATTR, cfg.mode);
}

/**
 * Processes all auto-sync badge rows in the document per the current settings.
 *
 * No-op when `autoSyncBadge.enabled` is false. Idempotent per row via the marker attribute.
 *
 * @param settings - The current settings.
 */
export function processAutoSyncBadge(settings: Settings): void {
    const cfg = settings.autoSyncBadge;
    if (!cfg.enabled) return;
    document.querySelectorAll<HTMLElement>(BADGE_ROW_SELECTOR).forEach((row) => {
        processBadgeItem(row, cfg);
    });
}

/** Restores all processed badge rows to visible and removes cloned icon/divider nodes. */
export function restoreAutoSyncBadge(): void {
    // * badge rows visible + marker removed.
    // * removeProperty is necessary (display:none !important was set via setProperty important;
    //   style.display="" only removes non-important inline styles, not !important).
    document.querySelectorAll<HTMLElement>(`[${TWEAKS_MARKER_ATTR}]`).forEach((row) => {
        row.style.removeProperty("display");
        row.removeAttribute(TWEAKS_MARKER_ATTR);
    });
    // * remove all clones (icon + divider).
    document.querySelectorAll<HTMLElement>(`.${TWEAKS_CLONE_CLASS}`).forEach((el) => {
        el.remove();
    });
}
