import type { Feature, ValidationError } from "../feature.types";
import type { PageCtx } from "../page";
import type { StartpageSettings, GridColumnsPreset } from "../settings";
import log, { isDebugEnabled } from "../log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: startpage-grid feature — grid column-count override (home/subscriptions/channel)
// ─────────────────────────────────────────────────────────────────────────────
// * Overrides the video column count on grid pages via YouTube's CSS variable
//   --ytd-rich-grid-items-per-row on ytd-rich-grid-renderer.
//   Applies to home/subscriptions/channel (same pages as grid-styling).
// * The loading skeleton (#home-container-media) is set to the same column count
//   so the placeholder cards don't reflow on load (selectors adopted from
//   R4ULtv/youtube-grid-layout-changer; verify live when the DOM changes).
// * `default` preset → NO override (YT-native responsive). All other presets
//   ("1"–"10", custom) → emit CSS rules.

/** Preset → fixed column count (custom is resolved separately). */
const PRESET_COLUMNS: Record<Exclude<GridColumnsPreset, "default" | "custom">, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
};

/** Min/max for customColumns (defense-in-depth next to the validator). */
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 10;

/** Selector for the rich-grid renderer (carries the Polymer variable). */
const GRID_SEL = "ytd-rich-grid-renderer";
/** Marker attribute for restore (on ytd-rich-grid-renderer). */
const GRID_ATTR = "data-yt-tweaks-grid-columns";

/**
 * Resolves the effective column count from the preset.
 *
 * - `"1"`–`"10"` → fixed value from PRESET_COLUMNS.
 * - `custom` → `customColumns`, clamped to [1, 10].
 * - `default` → 3 (never applied — the caller emits no rules for default;
 *   the fallback exists only as defense-in-depth).
 *
 * @param s - The startpage settings slice.
 * @returns The resolved column count.
 */
function resolveColumns(s: StartpageSettings): number {
    if (s.columnsPreset === "custom") {
        const n = Math.floor(Number(s.customColumns));
        return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, n || MIN_COLUMNS));
    }
    if (s.columnsPreset === "default") return 3;
    return PRESET_COLUMNS[s.columnsPreset] ?? 3;
}

/**
 * Generates the grid-column-count override CSS from the startpage slice.
 *
 * Emits no rules when disabled or when `columnsPreset === "default"` (YT-native).
 * Otherwise sets `--ytd-rich-grid-items-per-row` + skeleton grid rules.
 *
 * @param slice - The startpage settings slice.
 * @returns CSS rule strings.
 */
function startpageGridCss(slice: unknown): string[] {
    const s = slice as StartpageSettings;
    if (!s.enabled) return [];
    if (s.columnsPreset === "default") return [];
    const n = resolveColumns(s);
    return [
        // * Video grid: YouTube controls the columns via --ytd-rich-grid-items-per-row.
        `ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: ${n} !important; }`,
        // * Loading skeleton: a separate flex layout with inline 310px sizes. Force its
        //   own grid so the placeholders get the same column count as the loaded grid
        //   (no size jump on load). Selectors adopted from
        //   R4ULtv/youtube-grid-layout-changer.
        `#home-container-media { display: grid !important; grid-template-columns: repeat(${n}, minmax(0, 1fr)) !important; column-gap: 16px; }`,
        `#home-container-media > .rich-grid-media-skeleton { width: auto !important; min-width: 0 !important; max-width: none !important; margin-inline: 0 !important; flex: none !important; }`,
    ];
}

/**
 * Run: sets `--ytd-rich-grid-items-per-row` INLINE via JS on every
 * `ytd-rich-grid-renderer` (plus the restore marker).
 *
 * ! Why in addition to the CSS: YouTube's Polymer reads the grid column count
 *   from the custom property via `this.style.getPropertyValue` (inline read),
 *   NOT from the computed stylesheet value. A global `<style>` with `!important`
 *   does not reliably reach Polymer's scoped property resolution → Polymer does
 *   not re-layout on SPA page switches (watch→home) nor on preset changes.
 *   Setting it inline via JS reliably triggers Polymer's property observer.
 *   The MutationObserver (observer.ts) re-applies the inline value on
 *   lazy-loaded grids / SPA re-renders.
 *
 * @param ctx - The page context.
 */
function startpageGridRun(ctx: PageCtx): void {
    const s = ctx.settings.startpage;
    if (!s.enabled || s.columnsPreset === "default") {
        startpageGridRestore();
        return;
    }
    const n = resolveColumns(s);
    for (const grid of document.querySelectorAll<HTMLElement>(GRID_SEL)) {
        grid.style.setProperty("--ytd-rich-grid-items-per-row", String(n));
        grid.setAttribute(GRID_ATTR, String(n));
    }
    // * Runs on every observer tick (no idempotency early-return) — guard the string build.
    if (isDebugEnabled()) {
        log.debug("startpage-grid", `applied ${n} columns inline on ${GRID_SEL}`);
    }
}

/**
 * Restore: reverts the inline grid variable (removes the marker + the property).
 */
function startpageGridRestore(): void {
    for (const el of document.querySelectorAll<HTMLElement>(`[${GRID_ATTR}]`)) {
        el.style.removeProperty("--ytd-rich-grid-items-per-row");
        el.removeAttribute(GRID_ATTR);
    }
}

/**
 * Validates the startpage slice: `customColumns` must be within [1, 10].
 *
 * Only relevant when `columnsPreset === "custom"` — otherwise the value has no
 * effect and is not flagged.
 *
 * @param slice - The startpage settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateStartpage(slice: unknown): ValidationError[] {
    const s = slice as StartpageSettings;
    const errors: ValidationError[] = [];
    if (s.columnsPreset === "custom") {
        const n = Number(s.customColumns);
        if (!Number.isFinite(n) || n < MIN_COLUMNS || n > MAX_COLUMNS || !Number.isInteger(n)) {
            errors.push({
                path: "startpage.customColumns",
                message: `Must be an integer between ${MIN_COLUMNS} and ${MAX_COLUMNS}`,
            });
        }
    }
    return errors;
}

/**
 * Startpage-grid feature: overrides the number of video columns on the homepage
 * grid (home/subscriptions/channel).
 *
 * * Mechanism: CSS-only via `--ytd-rich-grid-items-per-row` on
 *   `ytd-rich-grid-renderer` (verified — see gist boydaihungst). Skeleton
 *   selectors (`#home-container-media`, `.rich-grid-media-skeleton`) are
 *   borrowed from R4ULtv/youtube-grid-layout-changer — live-verify.
 * ~ DECISION-LOG: `default` preset = no override (YT-native responsive); the
 *   numeric presets `"1"`–`"10"` and `custom` (via `customColumns`) emit the
 *   grid-variable + skeleton-grid rules.
 */
export const startpageGridFeature: Feature = {
    id: "startpage-grid",
    settingsPath: "startpage",
    pages: {
        home: { css: startpageGridCss, run: startpageGridRun, restore: startpageGridRestore },
        subscriptions: { css: startpageGridCss, run: startpageGridRun, restore: startpageGridRestore },
        channel: { css: startpageGridCss, run: startpageGridRun, restore: startpageGridRestore },
    },
    liveApplyKeys: ["startpage.enabled", "startpage.columnsPreset", "startpage.customColumns"],
    validate: validateStartpage,
};
