import type { Feature, ValidationError } from "../feature.types";
import type { FeedChipsSettings, ChipColorMode } from "../settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: feed-chips feature — homepage filter-chip color override (pure CSS)
// ─────────────────────────────────────────────────────────────────────────────
// * Pure CSS: overrides the background color of active (selected) and inactive (non-selected)
//   homepage filter chips. No DOM mutation, no JS handlers — only CSS rules emitted via the
//   registry. Applies only to the home page (the chip bar is home-only).
//
// * Each color setting is an enum (preset) + a custom-hex fallback: when the mode is "custom",
//   the accompanying `*Hex` field supplies the CSS color (validated by the feature validator).
//   "default" = no override (YT-native).
//
// * Selectors verified via live probe + live DOM dump (2026-08-23/26):
//   - Chip:      yt-chip-cloud-chip-renderer (11-13 matches) — the legacy
//                ytd-feed-filter-chip-renderer no longer exists (YT DOM changed).
//   - Selected:  [selected] + .iron-selected + button[aria-selected="true"].
//   - Visible background area = the inner <div class="ytChipShapeChip ytChipShapeActive">
//     (active chip) / ytChipShapeInactive (inactive chip) — NOT the outer button.
//
// ~ DECISION-LOG (history — pin/reorder abandoned, see plan):
//   * Pin/move icons + DOM reordering were implemented in an earlier round, then
//     abandoned — too fragile (CustomEvent bridge, session-bound tokens, clone non-functional).
//   * Own filter chips / cross-session replay: not feasible (probe-verified).
//   * Current model: pure CSS color override, stable, no DOM mutation.

/** Chip custom-element selector (verified 2026-08-23). */
const CHIP_SEL = "yt-chip-cloud-chip-renderer";

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
 * Returns the effective CSS color for a mode+hex pair.
 *
 * ! Custom hex is re-validated HERE (CSS-injection guard): the GUI validator only FLAGS an
 *   invalid hex, but the value is still persisted — the CSS boundary must not interpolate
 *   garbage into a stylesheet rule. Invalid custom hex falls back to "no override".
 *
 * @param mode   - The color mode (preset, "default", or "custom").
 * @param hex    - The hex value (only relevant when `mode === "custom"`).
 * @param presets - The preset map matching the chip role (active vs inactive).
 * @returns The CSS color, or null when there is no override (`mode === "default"`).
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
 * Builds the chip-bar CSS: active + inactive chip background-color overrides.
 *
 * @param slice - The feed-chips settings slice.
 * @returns CSS rule strings (empty when disabled).
 */
function chipsCss(slice: unknown): string[] {
    const c = slice as FeedChipsSettings;
    if (!c.enabled) return [];
    const rules: string[] = [];
    const active = resolveColor(c.activeColor, c.activeColorHex, ACTIVE_PRESETS);
    const inactive = resolveColor(c.inactiveColor, c.inactiveColorHex, INACTIVE_PRESETS);
    // * Active (selected) chip: target the inner .ytChipShapeChip (verified via live-DOM dump
    //   2026-08-26 — the visible background is on the inner div, not the outer button).
    //   color:#fff keeps text readable on colored backgrounds (dark+light mode).
    if (active) {
        rules.push(
            `${CHIP_SEL}[selected] .ytChipShapeChip,` +
                `${CHIP_SEL}.iron-selected .ytChipShapeChip` +
                ` { background-color:${active} !important; color:#fff !important; }`,
        );
    }
    // * Inactive (non-selected) chips: :not([selected]):not(.iron-selected) excludes the active
    //   one. No color override — YT-native text color stays (only the background is tinted).
    if (inactive) {
        rules.push(
            `${CHIP_SEL}:not([selected]):not(.iron-selected) .ytChipShapeChip` +
                ` { background-color:${inactive} !important; }`,
        );
    }
    // * Layout: `hide` removes the home chip bar entirely (pure CSS display:none — the home chip
    //   bar is a 0-height overlay, so hiding it leaves no gap and no overlap). `collapse` (default)
    //   = YT-native carousel. `stack` is NOT supported on home: the 0-height overlay means wrapped
    //   chips overlap the grid and CSS cannot push the grid below them (verified via live-probe
    //   2026-08-28 — height/min-height/custom-property all fail to move the grid).
    if (c.layout === "hide") {
        rules.push("ytd-feed-filter-chip-bar-renderer { display:none !important; }");
    }
    return rules;
}

/**
 * Validates the feed-chips slice: custom-hex fields must match the hex regex when their mode
 * is "custom".
 *
 * @param slice - The feed-chips settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateFeedChips(slice: unknown): ValidationError[] {
    const c = slice as FeedChipsSettings;
    const errors: ValidationError[] = [];
    if (c.activeColor === "custom" && !HEX_RE.test(c.activeColorHex.trim())) {
        errors.push({
            path: "feedChips.activeColorHex",
            message: "Must be a hex color (#rgb | #rrggbb | #rrggbbaa)",
        });
    }
    if (c.inactiveColor === "custom" && !HEX_RE.test(c.inactiveColorHex.trim())) {
        errors.push({
            path: "feedChips.inactiveColorHex",
            message: "Must be a hex color (#rgb | #rrggbb | #rrggbbaa)",
        });
    }
    return errors;
}

/**
 * Feed-chips feature: homepage filter-chip active + inactive color override + layout modes
 * `collapse` (native) / `hide` (pure CSS).
 *
 * * DOM-Fixture: none captured — CSS selectors manually verified via live-probe + live-DOM
 *   dump (2026-08-23/26). Pure CSS, no DOM mutation → no run/restore behaviors.
 * ~ DECISION-LOG: pure CSS color override (pin/reorder/own chips abandoned — see module
 *   header). Custom-hex validated via feature validator (regex) so invalid values never reach
 *   the generated CSS. Active chip gets color:#fff for text contrast; inactive keeps YT-native
 *   text color (only background tinted). `stack` is NOT supported on home (0-height overlay —
 *   see chipsCss); only watch-chips offers the stacked layout.
 */
export const feedChipsFeature: Feature = {
    id: "feed-chips",
    settingsPath: "feedChips",
    pages: {
        home: { css: chipsCss },
    },
    liveApplyKeys: [
        "feedChips.enabled",
        "feedChips.activeColor",
        "feedChips.activeColorHex",
        "feedChips.inactiveColor",
        "feedChips.inactiveColorHex",
        "feedChips.layout",
    ],
    validate: validateFeedChips,
};
