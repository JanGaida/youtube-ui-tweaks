import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { GuideSettings, GuideVisibility } from "../settings";
import { guideSidebarFSM } from "../guide-sidebar-state";
import log from "../log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: guide-visibility feature — guide-pane visibility (CSS + FSM)
// ─────────────────────────────────────────────────────────────────────────────
// * Controls the visibility of the guide sidebar pane (NOT the hamburger icon).
//   Phase 8: hide-forced removes guide-persistent-and-visible from the masthead +
//   opened/persistent from the drawer via the FSM → YT's native JS layout collapses the
//   content shift. hide-override lets YT's native toggle run through; the FSM only
//   observes it read-only. CSS: hide-override/hide-forced hide ONLY the mini-guide via
//   display:none.
//
// * Conflict resolution: hideHamburger=true + hide-override → the hamburger is hidden,
//   so the native toggle path is dead → the feature hands "hide-forced" to the FSM.
//   Fallback is logged once (debug), no UI hint.

/**
 * Resolves the effective visibility mode (conflict resolution).
 *
 * When hideHamburger=true and visibility=hide-override, the hamburger is hidden → the
 * native toggle is unreachable → fall back to hide-forced.
 *
 * @param visibility   - The guide.visibility setting value.
 * @param hideHamburger - The styling.masthead.hideHamburger setting value.
 * @returns The effective mode for the FSM.
 */
function resolveVisibility(visibility: GuideVisibility, hideHamburger: boolean): GuideVisibility {
    if (visibility === "hide-override" && hideHamburger) {
        logFallback();
        return "hide-forced";
    }
    return visibility;
}

let fallbackLogged = false;
function logFallback(): void {
    if (fallbackLogged) return;
    fallbackLogged = true;
    log.debug("guide-sidebar", "conflict: hideHamburger=true + hide-override → fallback to hide-forced");
}

/**
 * Generates CSS for guide-pane visibility.
 *
 * @param slice - The guide settings slice.
 * @returns CSS rule strings.
 */
function guideVisibilityCss(slice: unknown): string[] {
    const g = slice as GuideSettings;
    if (!g.enabled) return [];
    const rules: string[] = [];
    if (g.visibility === "hide-override") {
        // * Always hide the mini-guide — the large menu opens/closes natively (hamburger).
        rules.push(`ytd-mini-guide-renderer { display: none !important; }`);
    }
    if (g.visibility === "hide-forced") {
        // * Phase 8: the guide itself is collapsed via attribute removal (FSM), NOT display:none
        //   (display:none would prevent YT's JS layout from doing the content-shift reflow).
        //   Only the mini-guide is hidden via CSS.
        rules.push(`ytd-mini-guide-renderer { display: none !important; }`);
    }
    // * "default" → no change.
    return rules;
}

/**
 * Run: activates the FSM with the resolved visibility mode.
 *
 * Reads guide.visibility + styling.masthead.hideHamburger, resolves conflicts,
 * and passes the effective mode to guideSidebarFSM.enter().
 *
 * @param ctx - The page context.
 */
function guideVisibilityRun(ctx: PageCtx): void {
    const g = ctx.settings.guide;
    if (!g.enabled) {
        guideSidebarFSM.exit();
        return;
    }
    const hideHamburger = ctx.settings.styling.masthead.hideHamburger;
    const effective = resolveVisibility(g.visibility, hideHamburger && ctx.settings.styling.masthead.enabled);
    guideSidebarFSM.enter(effective);
}

/**
 * Restore: leave the FSM (stop the observer, state → inactive).
 */
function guideVisibilityRestore(): void {
    fallbackLogged = false;
    guideSidebarFSM.exit();
}

/**
 * Guide-visibility feature: guide pane visibility (CSS + FSM-controlled).
 *
 * * FSM: src/lib/core/guide-sidebar-state.ts — states default/hide-forced/hide-override-closed/opened.
 *   Phase 8: attribute removal in enter() (initial setup) + read-only attribute observer
 *   (state-sync). NO click interceptor — YT's native toggle runs through.
 * * DOM fixture: __fixtures__/masthead.fixture.html contains <ytd-masthead guide-persistent-and-visible="">.
 *   Selector `#guide-button` confirmed (masthead.fixture.html:37).
 * ~ DECISION-LOG: conflict resolution (hideHamburger + hide-override) in the feature run(), NOT in
 *   the FSM → the FSM does not know hideHamburger and stays responsible only for pane visibility.
 */
export const guideVisibilityFeature: Feature = {
    id: "guide-visibility",
    settingsPath: "guide",
    pages: {
        "*": { css: guideVisibilityCss, run: guideVisibilityRun, restore: guideVisibilityRestore },
    },
    liveApplyKeys: ["guide.enabled", "guide.visibility", "styling.masthead.hideHamburger", "styling.masthead.enabled"],
};
