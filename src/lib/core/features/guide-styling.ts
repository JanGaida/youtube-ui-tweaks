import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { GuideSettings, GuideWidthPreset } from "../settings";
import log from "../log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: guide-styling feature — guide pane width (enum presets) + icon visibility
// ─────────────────────────────────────────────────────────────────────────────
// * The width is controlled purely via CSS (no resize event — that triggered
//   YT's layout JS and hid the guide).
//
// * Fix Issue 1 (double offset / content does not follow):
//   YT natively sets a 240px content offset (via padding-left on #page-manager). If we
//   only change the drawer width, a gap appears (drawer narrower, content stays
//   at 240px). If we set margin-left IN ADDITION → double offset (grid squeezed).
//   Solution: set the content offset EXPLICITLY — padding-left: 0 (kill the native one) +
//   margin-left: {px}px (set ours) → total offset = preset, no doubling.
//
// * The Polymer variable --app-drawer-width on ytd-app controls the drawer width.
//
// * Presets:
//   - default (240px) — no mutation.
//   - compact (200px) / large (280px) — variable + content-offset override.
//
// * Selectors verified against __fixtures__/guide-full.fixture.html (captured 2026-08-22):
//   - #guide = tp-yt-app-drawer (width: 240px, attrs: opened/persistent/position/swipe-open)
//   - ytd-guide-renderer = inner renderer (width: 240px) — appears TWICE (in the drawer + standalone)
//   - Entry icons: yt-icon.guide-icon + channel avatars: yt-img-shadow
// * ! #page-manager is the content container (standard YT structure) — not in the fixture,
//   but confirmed live as an ancestor of ytd-two-column-browse-results-renderer.

const APP_SEL = "ytd-app";
const DRAWER_SEL = "tp-yt-app-drawer#guide";
const RENDERER_SEL = "ytd-guide-renderer";
const CONTENT_SEL = "#page-manager";
const WIDTH_VAR = "--app-drawer-width";

/** Preset → pixel width. */
const PRESET_PX: Record<Exclude<GuideWidthPreset, "default">, number> = {
    compact: 200,
    large: 280,
};

/** Marker attribute for restore (on ytd-app + drawer + renderers). */
const WIDTH_ATTR = "data-yt-tweaks-guide-width";

let lastPreset: GuideWidthPreset | null = null;

/**
 * Generates CSS for guide-pane styling (icon visibility + width + content offset).
 *
 * Drawer width via --app-drawer-width + width override; content offset via
 * padding-left: 0 (kill the native one) + margin-left: {px} (set ours) → no double offset.
 *
 * @param slice - The guide settings slice.
 * @returns CSS rule strings.
 */
function guideStylingCss(slice: unknown): string[] {
    const g = slice as GuideSettings;
    if (!g.enabled) return [];
    const rules: string[] = [];
    if (g.width === "compact" || g.width === "large") {
        const px = PRESET_PX[g.width];
        // * Drawer width: Polymer variable (cascades down from ytd-app) + width override.
        rules.push(`${APP_SEL} { ${WIDTH_VAR}: ${px}px !important; }`);
        rules.push(`${DRAWER_SEL}, ${RENDERER_SEL} { width: ${px}px !important; min-width: ${px}px !important; }`);
        // * Content offset: ONLY when the drawer is open (tp-yt-app-drawer#guide[opened]).
        //   ! Bug 4: previously margin-left:px was set statically → on collapse the offset
        //     remained → the centered content did not take over the freed space (gap).
        //   padding-left:0 only in the open case (kills the native 240px, no double offset).
        rules.push(
            `${APP_SEL}:has(${DRAWER_SEL}[opened]) ${CONTENT_SEL} { margin-left: ${px}px !important; padding-left: 0 !important; }`,
        );
        // * Bug 4b: with hide-override/hide-forced the mini-guide is display:none via CSS
        //   (guide-visibility.ts) → when collapsed a 72px gap appears (YT's native
        //   mini-guide offset remains without a visible mini-guide). So when collapsed → force
        //   offset 0. Not with visibility=default — there the mini-guide is visible and
        //   YT's native 72px offset is correct (no rule from us → no overlap).
        if (g.visibility === "hide-override" || g.visibility === "hide-forced") {
            rules.push(
                `${APP_SEL}:has(${DRAWER_SEL}:not([opened])) ${CONTENT_SEL} { margin-left: 0 !important; padding-left: 0 !important; }`,
            );
        }
    }
    if (!g.showIcon) {
        // * Hide entry icons in the EXPANDED guide (text only).
        rules.push(
            `ytd-guide-entry-renderer .guide-icon, ytd-guide-entry-renderer yt-img-shadow { display: none !important; }`,
        );
    }
    if (g.miniText) {
        // * Mini-guide: hide entry titles (icons only, native 72px mode, cleaner look).
        //   miniText=false = native mini-guide (icon on top, text below, vertical) → nothing to do.
        //   Live DOM (2026-08-22): ytd-mini-guide-entry-renderer > a#endpoint > span.title
        //   (NOT yt-formatted-string). display:none only — do NOT bend the layout (no flex-
        //   direction:row, that made the icon tiny + text inline next to it).
        // ! Specificity: YT's ShadyCSS scoped rule `.title.style-scope.ytd-mini-guide-entry-renderer`
        //   beats our `.title` at equal !important. Anchoring via `a#endpoint` (id selector)
        //   raises our specificity above the scoped rule → display:none applies reliably.
        rules.push(`ytd-mini-guide-entry-renderer a#endpoint .title { display: none !important; }`);
        rules.push(`ytd-mini-guide-entry-renderer tp-yt-paper-tooltip { display: none !important; }`);
    }
    if (!g.showFooter) {
        // * Hide the guide footer: the enclosing #footer div (links + copyright).
        //   Structure (live DOM 2026-08-23): ytd-guide-renderer > #footer > #guide-links-primary,
        //   #guide-links-secondary, #copyright. Hiding #footer takes everything with it.
        rules.push(`ytd-guide-renderer #footer { display: none !important; }`);
    }
    return rules;
}

/**
 * Run: sets the width marker on drawer/renderers (for restore). The content offset is
 * purely CSS-controlled (guideStylingCss, :has(drawer[opened])) — NO JS inline offset
 * anymore (that pinned the offset statically and prevented the content shift on collapse).
 *
 * @param ctx - The page context.
 */
function guideStylingRun(ctx: PageCtx): void {
    const g = ctx.settings.guide;
    if (!g.enabled) return;
    const preset = g.width;
    if (preset === lastPreset && document.querySelector(DRAWER_SEL)) return;
    lastPreset = preset;
    if (preset === "default") return;

    const px = PRESET_PX[preset];
    // * Markers on ytd-app + drawer + renderers (for restore).
    const app = document.querySelector<HTMLElement>(APP_SEL);
    if (app) app.setAttribute(WIDTH_ATTR, String(px));
    const drawer = document.querySelector<HTMLElement>(DRAWER_SEL);
    if (drawer) drawer.setAttribute(WIDTH_ATTR, String(px));
    for (const r of document.querySelectorAll<HTMLElement>(RENDERER_SEL)) {
        r.setAttribute(WIDTH_ATTR, String(px));
    }
    log.debug("guide-styling", `${preset} (${px}px): applied width (content offset via CSS :has)`);
}

/**
 * Restore: reverts the JS-based width effects (inline styles + marker attribute).
 */
function guideStylingRestore(): void {
    for (const el of document.querySelectorAll<HTMLElement>(`[${WIDTH_ATTR}]`)) {
        if (
            el.id === "page-manager" ||
            el.id === "guide" ||
            el.tagName === "YTD-APP" ||
            el.tagName === "YTD-GUIDE-RENDERER"
        ) {
            el.style.marginLeft = "";
            el.style.paddingLeft = "";
        }
        el.removeAttribute(WIDTH_ATTR);
    }
    lastPreset = null;
}

/**
 * Guide-styling feature: Guide-Pane width (Enum-Presets) + icon visibility (global `*`).
 *
 * * Selektoren verifiziert gegen __fixtures__/guide-full.fixture.html (captured 2026-08-22).
 * ~ DECISION-LOG: Phase 8 ersetzt numeric width.mini/full-Slider durch Enum-Presets.
 *   Fix Issue 1: Content-Offset via padding-left: 0 + margin-left: {px} (kein Double-Offset,
 *   kein resize-Event — das hat den Guide versteckt).
 */
export const guideStylingFeature: Feature = {
    id: "guide-styling",
    settingsPath: "guide",
    pages: {
        "*": { css: guideStylingCss, run: guideStylingRun, restore: guideStylingRestore },
    },
    liveApplyKeys: [
        "guide.width",
        "guide.showIcon",
        "guide.miniText",
        "guide.showFooter",
        "guide.enabled",
        "guide.visibility",
    ],
};
