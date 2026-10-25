import type { Feature, ValidationError } from "../feature.types";
import type { WatchChipsSettings, ChipColorMode } from "../settings";
import { stackLayoutCss, CHIP_SEL } from "./chip-layout";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: watch-chips feature — watch-page related-chip-bar color override (pure CSS)
// ─────────────────────────────────────────────────────────────────────────────
// * Pure CSS: overrides the background color of active (selected) and inactive (non-selected)
//   chips in the watch page's related-video sidebar chip bar. No DOM mutation, no JS handlers —
//   only CSS rules emitted via the registry. Applies only to the watch page.
//
// * DOM (verified via user-provided HTML 2026-08-28): the watch-page related chip bar is
//   `yt-related-chip-cloud-renderer` wrapping the same `yt-chip-cloud-chip-renderer` chips as the
//   homepage, with the same inner `.ytChipShapeChip ytChipShapeActive`/`ytChipShapeInactive`
//   surface. The CSS model is identical to feed-chips — only the page scope differs (watch vs home)
//   and the scoping is tightened to `yt-related-chip-cloud-renderer` to avoid touching any
//   homepage chip bar that might coexist transiently during SPA transitions.

/** Regex for valid hex colors: #rgb | #rrggbb | #rrggbbaa. */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Active-chip preset map: enum preset → CSS color (except "default"/"custom"). */
const ACTIVE_PRESETS: Record<Exclude<ChipColorMode, "default" | "custom">, string> = {
    red: "#b30024",
    blue: "#0047b3",
    green: "#007700",
    purple: "#6b008f",
    orange: "#b35f00",
};

/** Inactive-chip preset map: darker variants of the active hues (≈43% of the active value). */
const INACTIVE_PRESETS: Record<Exclude<ChipColorMode, "default" | "custom">, string> = {
    red: "#4e0010",
    blue: "#001f4e",
    green: "#003400",
    purple: "#2f003e",
    orange: "#4e2900",
};

/**
 * Returns the effective CSS color for a mode+hex value.
 *
 * ! Custom hex is re-validated HERE (CSS-injection guard — see feed-chips.ts): an invalid
 *   persisted value falls back to "no override" instead of being interpolated into a rule.
 *
 * @param mode   - The color mode (preset, "default", or "custom").
 * @param hex    - The hex value (only relevant when `mode === "custom"`).
 * @param presets - The preset map matching the chip role (active vs inactive).
 * @returns The CSS color, or null when no override (`mode === "default"`).
 */
function resolveColor(
    mode: ChipColorMode,
    hex: string,
    presets: Record<Exclude<ChipColorMode, "default" | "custom">, string>,
): string | null {
    if (mode === "default") return null;
    if (mode === "custom") {
        const trimmed = hex.trim();
        return HEX_RE.test(trimmed) ? trimmed : null;
    }
    return presets[mode] ?? null;
}

/**
 * Builds the watch-page related-chip-bar CSS: active + inactive chip background overrides +
 * optional stack-layout (vertical chip list instead of carousel).
 *
 * @param slice - The watch-chips settings slice.
 * @returns CSS rule strings (empty when disabled).
 */
function watchChipsCss(slice: unknown): string[] {
    const c = slice as WatchChipsSettings;
    if (!c.enabled) return [];
    const rules: string[] = [];
    const active = resolveColor(c.activeColor, c.activeColorHex, ACTIVE_PRESETS);
    const inactive = resolveColor(c.inactiveColor, c.inactiveColorHex, INACTIVE_PRESETS);
    // * Scope to the related-chip-cloud renderer so homepage chips (if any coexist during SPA
    //   transition) are never affected.
    const SCOPE = "yt-related-chip-cloud-renderer";
    if (active) {
        rules.push(
            `${SCOPE} ${CHIP_SEL}[selected] .ytChipShapeChip,` +
                `${SCOPE} ${CHIP_SEL}.iron-selected .ytChipShapeChip` +
                ` { background-color:${active} !important; color:#fff !important; }`,
        );
    }
    if (inactive) {
        rules.push(
            `${SCOPE} ${CHIP_SEL}:not([selected]):not(.iron-selected) .ytChipShapeChip` +
                ` { background-color:${inactive} !important; }`,
        );
    }
    if (c.layout === "stack") {
        rules.push(
            ...stackLayoutCss({
                bar: "yt-related-chip-cloud-renderer yt-chip-cloud-renderer",
                row: "#container",
            }),
        );
    } else if (c.layout === "hide") {
        // * Hide the watch-page related chip bar entirely (pure CSS display:none — the related-chip
        //   renderer is a normal block, so hiding it leaves a clean gap, no overlap).
        rules.push(`${SCOPE} { display:none !important; }`);
    }
    return rules;
}

/**
 * Validates the watch-chips slice: custom-hex fields must match the hex regex when their mode
 * is "custom".
 *
 * @param slice - The watch-chips settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateWatchChips(slice: unknown): ValidationError[] {
    const c = slice as WatchChipsSettings;
    const errors: ValidationError[] = [];
    if (c.activeColor === "custom" && !HEX_RE.test(c.activeColorHex.trim())) {
        errors.push({
            path: "watchChips.activeColorHex",
            message: "Must be a hex color (#rgb | #rrggbb | #rrggbbaa)",
        });
    }
    if (c.inactiveColor === "custom" && !HEX_RE.test(c.inactiveColorHex.trim())) {
        errors.push({
            path: "watchChips.inactiveColorHex",
            message: "Must be a hex color (#rgb | #rrggbb | #rrggbbaa)",
        });
    }
    return errors;
}

/**
 * Watch-chips feature: watch-page related-chip-bar active + inactive color override (pure CSS).
 *
 * * DOM-Fixture: none captured — CSS selectors manually verified via user-provided HTML +
 *   live-DOM computed-style dump (2026-08-28). Pure CSS, no DOM mutation → no run/restore
 *   behaviors. Scoped to `yt-related-chip-cloud-renderer` to avoid touching the homepage chip bar.
 * ~ DECISION-LOG: mirrors feed-chips (reiner CSS-Farb-Override) but scoped to the watch page's
 *   related-chip-cloud renderer. Independent settings from feed-chips (own toggle + own colors)
 *   so home + watch chips can be styled separately. Layout mode `stack` overrides YT's carousel
 *   (`flex-direction:column` + `overflow:visible` + `transform:none` + arrows `display:none`).
 */
export const watchChipsFeature: Feature = {
    id: "watch-chips",
    settingsPath: "watchChips",
    pages: {
        watch: { css: watchChipsCss },
    },
    liveApplyKeys: [
        "watchChips.enabled",
        "watchChips.activeColor",
        "watchChips.activeColorHex",
        "watchChips.inactiveColor",
        "watchChips.inactiveColorHex",
        "watchChips.layout",
    ],
    validate: validateWatchChips,
};
