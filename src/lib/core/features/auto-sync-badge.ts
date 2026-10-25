import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { AutoSyncBadgeSettings } from "../settings";
import { processAutoSyncBadge, restoreAutoSyncBadge } from "../badge";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: auto-sync-badge feature — DOM move + CSS for the auto-sync badge
// ─────────────────────────────────────────────────────────────────────────────
// * hidden mode: inline display:none !important at element level (badge.ts) — beats stylesheet
//   collisions. NO CSS rule here for hidden (stylesheet can't beat !important stylesheet).
// * integrated-* modes: DOM-move (clone icon+divider into views row) + CSS flex centering.

/**
 * Builds the integrated-badge CSS rules (flex row centering + icon flex-item sizing).
 *
 * @param slice - The autoSyncBadge settings slice.
 * @param ctx   - The page context (used to read metaAlign from full settings).
 * @returns CSS rule strings.
 */
function badgeCss(slice: unknown, ctx: PageCtx): string[] {
    const ab = slice as AutoSyncBadgeSettings;
    if (!ab.enabled || (ab.mode !== "integrated-start" && ab.mode !== "integrated-end")) return [];
    const s = ctx.settings.styling;
    const jc =
        ab.mode && s.metaAlign === "center"
            ? "center"
            : s.metaAlign === "right"
              ? "flex-end"
              : s.metaAlign === "block"
                ? "space-between"
                : "flex-start";
    return [
        `.ytContentMetadataViewModelMetadataRow:has(.yt-tweaks-badge-clone) { display: flex !important; align-items: center !important; justify-content: ${jc} !important; flex-wrap: nowrap !important; gap: 8px !important; width: 100% !important; }`,
        `.yt-tweaks-badge-clone.ytBadgeShapeIcon { display: inline-flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }`,
    ];
}

/**
 * Runs the badge DOM-move pass (delegates to badge.ts).
 *
 * @param ctx - The page context.
 */
function badgeRun(ctx: PageCtx): void {
    processAutoSyncBadge(ctx.settings);
}

/**
 * Auto-sync-badge feature: DOM move + CSS for the "Auto-synced" badge in grid items.
 *
 * * DOM-Fixture: __fixtures__/badge-row.fixture.html (not yet captured — DOM run is manually
 *   verified). Shadow-DOM-Grenze: .ytBadgeShapeIcon internals (icon clone is light-DOM clone).
 * ~ DECISION-LOG: integrated modes clone the original .ytBadgeShapeIcon + .ytContentMetadataView
 *   ModelDelimiter 1:1 (inherits YT fill/color/spacing). hidden uses inline !important because
 *   stylesheet !important collides with YT's block + metaAlign block (same specificity).
 */
export const autoSyncBadgeFeature: Feature = {
    id: "auto-sync-badge",
    settingsPath: "autoSyncBadge",
    pages: {
        home: { css: badgeCss, run: badgeRun, restore: restoreAutoSyncBadge },
        subscriptions: { css: badgeCss, run: badgeRun, restore: restoreAutoSyncBadge },
        channel: { css: badgeCss, run: badgeRun, restore: restoreAutoSyncBadge },
    },
    liveApplyKeys: ["autoSyncBadge.enabled", "autoSyncBadge.mode", "autoSyncBadge.iconSizeEm", "autoSyncBadge.divider"],
    defaults: {
        autoSyncBadge: { enabled: false, mode: "original", iconSizeEm: 0.9, divider: "•" },
    },
};
