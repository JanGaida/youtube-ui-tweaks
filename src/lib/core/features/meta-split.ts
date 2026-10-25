import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import { runMetaSplit, restoreMetaSplit } from "../meta-split";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: meta-split feature — break-element pass for metaLayout:"split"
// ─────────────────────────────────────────────────────────────────────────────
// * Dedicated views+date line in grid-item metadata rows (analysis 2026-10-24):
//   channel names in line 1, views+date in line 2. DOM pass in core/meta-split.ts,
//   companion CSS (break box, views gap, delimiter displacement) in grid-styling.ts.
//
// * Registered AFTER text-shorten (features/index.ts): the pass anchors primarily on
//   the structural leading icon (order-independent), but its fallback anchor is the
//   views marker [data-yt-tweaks-views] — set by the text pass. Running in a separate
//   feature AFTER text-shorten means the marker already exists within the SAME
//   registry pass (boot runs runAll() once, then starts the observer — a first-pass
//   marker dependency on a LATER pass would never resolve on static fixtures and
//   would flash unsplit rows in live grids).
//
// * Shares the "styling" settings slice with grid-styling (two features may own the
//   same slice): CSS + validation stay with grid-styling, this feature only owns the
//   DOM pass + its live-apply keys.

/**
 * Runs the meta-split DOM pass for the page.
 *
 * @param ctx - The page context.
 */
function splitRun(ctx: PageCtx): void {
    runMetaSplit(ctx.settings);
}

/** Meta-split feature: dedicated views+date line (break-element DOM pass). */
export const metaSplitFeature: Feature = {
    id: "meta-split",
    settingsPath: "styling",
    pages: {
        home: { run: splitRun, restore: restoreMetaSplit },
        subscriptions: { run: splitRun, restore: restoreMetaSplit },
        channel: { run: splitRun, restore: restoreMetaSplit },
    },
    liveApplyKeys: ["styling.metaLayout", "styling.metaStatsGap"],
};
