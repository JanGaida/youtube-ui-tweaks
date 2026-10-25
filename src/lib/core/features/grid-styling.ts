import type { Feature, ValidationError } from "../feature.types";
import type { StylingSettings } from "../settings";
import { restoreMetaSplit } from "../meta-split";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: grid-styling feature — title/meta/avatar/menuButton CSS for grid pages
// ─────────────────────────────────────────────────────────────────────────────
// * Emits CSS for grid-item metadata styling (title size/align, meta size/align, avatar
//   size/hide, menu-button size/hide). Applies on grid-bearing pages (home, subscriptions,
//   channel); intentionally absent on watch (no grid there).
//
// * Typography hardening (ADR 0006): font-size + line-height are consumed as coupled preset
//   pairs — free-form rem inputs broke the line-clamp / min-height-calc invariants when the
//   pair was pathologically mismatched. Margins are removed (asymmetric margins made
//   center-align look off). metaSpacing (padding-top) is a 3-step enum.

/** Valid values for the typography size enums. */
const SIZE_PRESETS = ["xsmall", "small", "medium", "large", "xlarge"] as const;
/** Valid values for the meta-spacing enum. */
const SPACING_PRESETS = ["tight", "normal", "relaxed"] as const;
/** Valid values for the meta line-layout enum. */
const LAYOUT_PRESETS = ["mixed", "split"] as const;
/** Valid values for the line-2 views↔date gap enum. */
const STATS_GAP_PRESETS = ["tight", "normal", "relaxed"] as const;

/**
 * Title typography preset — font-size + line-height as a coupled pair (rem).
 *
 * line-height values are chosen so the pair never breaks -webkit-line-clamp or the
 * forceEqualHeight min-height calc (font-size × maxLines ≤ reserved height at every preset).
 */
export const TITLE_SIZE_MAP: Record<(typeof SIZE_PRESETS)[number], { fontSize: string; lineHeight: string }> = {
    xsmall: { fontSize: "1.1rem", lineHeight: "1.5rem" },
    small: { fontSize: "1.2rem", lineHeight: "1.65rem" },
    medium: { fontSize: "1.35rem", lineHeight: "1.85rem" },
    large: { fontSize: "1.5rem", lineHeight: "2.05rem" },
    xlarge: { fontSize: "1.65rem", lineHeight: "2.25rem" },
};

/** Meta typography preset — font-size + line-height as a coupled pair (rem). */
export const META_SIZE_MAP: Record<(typeof SIZE_PRESETS)[number], { fontSize: string; lineHeight: string }> = {
    xsmall: { fontSize: "1.0rem", lineHeight: "1.0rem" },
    small: { fontSize: "1.08rem", lineHeight: "1.08rem" },
    medium: { fontSize: "1.15rem", lineHeight: "1.15rem" },
    large: { fontSize: "1.25rem", lineHeight: "1.25rem" },
    xlarge: { fontSize: "1.35rem", lineHeight: "1.35rem" },
};

/** Meta spacing preset — padding-top between title block and meta row (rem). */
export const META_SPACING_MAP: Record<(typeof SPACING_PRESETS)[number], string> = {
    tight: "0.35rem",
    normal: "0.65rem",
    relaxed: "0.95rem",
};

/**
 * Views↔date gap preset in line 2 (only `metaLayout:"split"`).
 *
 * User decision 2026-10-24 (POC dev/poc/meta-row-split.poc.html): normal = 16px.
 */
export const STATS_GAP_MAP: Record<(typeof STATS_GAP_PRESETS)[number], string> = {
    tight: "8px",
    normal: "16px",
    relaxed: "24px",
};

/**
 * Validates the styling slice: size + spacing fields must be known enum values.
 *
 * @param slice - The styling settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateStyling(slice: unknown): ValidationError[] {
    const s = slice as StylingSettings;
    const errors: ValidationError[] = [];
    const enumChecks: { path: string; value: unknown; allowed: readonly string[] }[] = [
        { path: "styling.titleSize", value: s.titleSize, allowed: SIZE_PRESETS },
        { path: "styling.metaSize", value: s.metaSize, allowed: SIZE_PRESETS },
        { path: "styling.metaSpacing", value: s.metaSpacing, allowed: SPACING_PRESETS },
        { path: "styling.metaLayout", value: s.metaLayout, allowed: LAYOUT_PRESETS },
        { path: "styling.metaStatsGap", value: s.metaStatsGap, allowed: STATS_GAP_PRESETS },
    ];
    for (const c of enumChecks) {
        if (!c.allowed.includes(c.value as string)) {
            errors.push({ path: c.path, message: `Must be one of: ${c.allowed.join(", ")}` });
        }
    }
    return errors;
}

/** Avatar size label → pixel value map. */
const AVATAR_SIZE_MAP: Record<string, string> = {
    xsmall: "20px",
    small: "28px",
    medium: "36px",
    large: "48px",
    xlarge: "64px",
};

/** Menu-button size label → button click-area pixel map (icon scales at native 1:1.5 ratio). */
const MENU_BUTTON_SIZE_MAP: Record<string, string> = {
    xsmall: "16px",
    small: "20px",
    medium: "24px",
    large: "32px",
    xlarge: "40px",
};

/**
 * Builds the title + meta CSS rules from the styling slice.
 *
 * @param s - The styling settings slice.
 * @returns CSS rule strings.
 */
function titleMetaCss(s: StylingSettings): string[] {
    if (!s.enabled) return [];
    const title = TITLE_SIZE_MAP[s.titleSize] ?? TITLE_SIZE_MAP.medium;
    const meta = META_SIZE_MAP[s.metaSize] ?? META_SIZE_MAP.medium;
    const metaPaddingTop = META_SPACING_MAP[s.metaSpacing] ?? META_SPACING_MAP.normal;
    const rules: string[] = [
        `.ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelTextContainer { width: 100% !important; }`,
        `.ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelHeadingReset, .ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelTitle, .ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelTitle .ytAttributedStringHost { text-align: ${s.titleAlign} !important; }`,
        // * Full clamp chain (bug #1 fix): -webkit-line-clamp alone is not enough — YouTube's
        //   NATIVE max-height (dimensioned for the native line-height) clips the larger preset
        //   lines (3rd line half-cut). We own the whole chain: line-height (preset) × max-lines.
        //   "99" (all lines) releases the clamp entirely.
        ...(s.titleMaxLines === "99"
            ? [
                  `.ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelTitle { font-size: ${title.fontSize} !important; line-height: ${title.lineHeight} !important; -webkit-line-clamp: unset !important; max-height: none !important; }`,
              ]
            : [
                  `.ytLockupMetadataViewModelStandard.ytLockupMetadataViewModelRichGridLegacyTypography .ytLockupMetadataViewModelTitle { font-size: ${title.fontSize} !important; line-height: ${title.lineHeight} !important; -webkit-line-clamp: ${s.titleMaxLines} !important; max-height: calc(${title.lineHeight} * ${s.titleMaxLines}) !important; overflow: hidden !important; display: -webkit-box !important; -webkit-box-orient: vertical !important; }`,
              ]),
        `.ytContentMetadataViewModelMediumText .ytContentMetadataViewModelMetadataText { font-size: ${meta.fontSize} !important; line-height: ${meta.lineHeight} !important; }`,
        `.ytLockupMetadataViewModelMetadata { padding-top: ${metaPaddingTop} !important; }`,
    ];
    // * forceEqualHeight: make all items in a row the same height by stretching the grid cells.
    //   The metadata block keeps its natural height (title 1-3 lines, meta directly below); the
    //   spare space lands at the END (between meta and menu button) via margin-top:auto on the
    //   menu button. Skipped for "99" (all lines — variable heights).
    //   ! Title gets a min-height of (titleLineHeight * titleMaxLines) so all titles reserve the
    //   same vertical space — 1-line titles don't push meta to the bottom (fixes the gap-between-
    //   title-and-meta problem the old flex-grow:1 approach caused).
    //   Chain: ytd-rich-item-renderer (grid cell, stretched) → #content → yt-lockup-view-model →
    //   .ytLockupViewModelHost (flex column, thumbnail top + metadata + menu bottom).
    if (s.forceEqualHeight && s.titleMaxLines !== "99") {
        rules.push(
            // * Grid container: stretch all items to the tallest in each row.
            `ytd-rich-grid-renderer { align-items: stretch !important; }`,
            // * Each item fills its grid cell height.
            `ytd-rich-grid-renderer > ytd-rich-item-renderer { align-self: stretch !important; }`,
            // * Propagate 100% height down the chain so the flex column reaches the cell height.
            `ytd-rich-grid-renderer > ytd-rich-item-renderer > #content { height: 100% !important; }`,
            `ytd-rich-grid-renderer > ytd-rich-item-renderer .ytLockupViewModelWrapper { height: 100% !important; }`,
            // * The lockup host becomes a flex column: thumbnail (fixed) + metadata (natural) +
            //   menu (margin-top:auto pushes it to the bottom → spare space lands above menu).
            `ytd-rich-grid-renderer > ytd-rich-item-renderer:not([is-shelf-item]) .ytLockupViewModelHost { display: flex !important; flex-direction: column !important; height: 100% !important; }`,
            // * Title reserves max-lines worth of height — all titles equal-tall, meta starts at
            //   the same Y position regardless of actual title length (1 vs 3 lines).
            `ytd-rich-grid-renderer > ytd-rich-item-renderer:not([is-shelf-item]) .ytLockupMetadataViewModelTitle { min-height: calc(${title.lineHeight} * ${s.titleMaxLines}) !important; }`,
            // * Menu button pushed to the bottom — spare space lands between meta and menu
            //   (NOT between title and meta, which looked broken with the old flex-grow approach).
            `ytd-rich-grid-renderer > ytd-rich-item-renderer:not([is-shelf-item]) .ytLockupMetadataViewModelMenuButton { margin-top: auto !important; }`,
        );
    }
    // * Row layout: metaLayout "split" (break-element pass in meta-split.ts) REQUIRES inline
    //   flow — flex would turn the break into a gap-inflated flex item and space-between would
    //   pull multi-channel names apart (Fall 2 analysis 2026-10-24). metaAlign "block" has no
    //   per-line meaning in a split row → documented fallback to start (user decision).
    //   Without split, metaAlign keeps its original semantics (flex space-between | text-align).
    const isSplit = s.metaLayout === "split";
    if (!isSplit && s.metaAlign === "block") {
        rules.push(
            `.ytLockupMetadataViewModelMetadata .ytContentMetadataViewModelMetadataRow { display: flex !important; justify-content: space-between !important; align-items: center !important; gap: 8px !important; width: 100% !important; }`,
        );
    } else {
        const align = isSplit && s.metaAlign === "block" ? "left" : s.metaAlign;
        rules.push(
            `.ytLockupMetadataViewModelMetadata .ytContentMetadataViewModelMetadataRow { display: block !important; width: 100% !important; text-align: ${align} !important; }`,
        );
    }
    // * Split companion rules (the DOM pass inserts .yt-tweaks-rowbreak before the views unit):
    //   - break box: display:block + height 0 ends line 1 inside the inline flow.
    //   - views gap: constant margin instead of YT's delimiter roulette (" " single-channel,
    //     EMPTY multi-channel — analysis 2026-10-24). Marker-driven (bug #11): only texts the
    //     text pass classified as views get the gap — never channel names.
    //   - delimiter displacement: the delimiter between views and date is hidden (the margin
    //     above carries the separation) — empty delimiters would glue, " " ones would stack.
    if (isSplit) {
        const gap = STATS_GAP_MAP[s.metaStatsGap] ?? STATS_GAP_MAP.normal;
        // * Delimiter normalization (measured live 2026-10-24): YT gives EVERY delimiter
        //   margin 4px/4px — an EMPTY multi-channel delimiter (0px wide) therefore renders
        //   a ~8px double-space between the channel names. Margins neutralized; empty
        //   delimiters get a real space char (::before) so the join matches single-channel
        //   rows exactly. Trailing spaces before the break hang at line end (no center
        //   shift); line-2 delimiters stay displaced (the views margin carries the gap).
        rules.push(
            `.ytContentMetadataViewModelMetadataRow .yt-tweaks-rowbreak { display: block !important; height: 0 !important; }`,
            `[data-yt-tweaks-views] { margin-inline-end: ${gap} !important; }`,
            `[data-yt-tweaks-views] + .ytContentMetadataViewModelDelimiter { display: none !important; }`,
            `.ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter { margin: 0 !important; padding: 0 !important; }`,
            `.ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter:empty::before { content: " " !important; }`,
        );
    }
    return rules;
}

/**
 * Builds the avatar CSS rules from the styling slice.
 *
 * @param s - The styling settings slice.
 * @returns CSS rule strings.
 */
function avatarCss(s: StylingSettings): string[] {
    if (!s.avatar.enabled && !s.avatar.hide) return [];
    const rules: string[] = [];
    if (s.avatar.hide) {
        rules.push(`.ytLockupMetadataViewModelAvatar { display: none !important; }`);
    }
    if (s.avatar.enabled) {
        const px = AVATAR_SIZE_MAP[s.avatar.size];
        if (px) {
            rules.push(
                `.ytSpecAvatarShapeAvatarSizeMedium, .ytSpecAvatarShapeAvatarSizeSmall, .ytSpecAvatarShapeAvatarSizeLarge { width: ${px} !important; height: ${px} !important; min-width: ${px} !important; }`,
                `.ytSpecAvatarShapeAvatarSizeMedium img, .ytSpecAvatarShapeAvatarSizeSmall img, .ytSpecAvatarShapeAvatarSizeLarge img { width: ${px} !important; height: ${px} !important; }`,
                `.ytLockupMetadataViewModelAvatar { margin-right: ${s.avatar.margin} !important; }`,
            );
        }
    }
    return rules;
}

/**
 * Builds the menu-button CSS rules from the styling slice.
 *
 * * Sizing targets ONLY the <button> (native size M ≈ 36×36px with 24px icon). The wrapper
 *   .ytLockupMetadataViewModelMenuButton keeps its native margin (YT positions the button
 *   flush to the metadata block's right edge) — overriding it made the button jump into the
 *   corner. The icon scales proportionally (native ratio: button = 1.5 × icon).
 * ! padding must be zeroed: the native MainstagePadding is fixed (not relative), so a resized
 *   button with leftover padding renders the hover circle oval/stadium-shaped. border-radius:50%
 *   keeps the hover/feedback layer a perfect circle at every preset size.
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html — button.ytSpecButtonShapeNextIconButton
 *   inside .ytLockupMetadataViewModelMenuButton > button-view-model; feedback = yt-touch-feedback-shape.
 *
 * @param s - The styling settings slice.
 * @returns CSS rule strings.
 */
function menuButtonCss(s: StylingSettings): string[] {
    if (!s.menuButton.enabled) return [];
    if (s.menuButton.hide) {
        return [`.ytLockupMetadataViewModelMenuButton { display: none !important; }`];
    }
    const px = MENU_BUTTON_SIZE_MAP[s.menuButton.size];
    if (!px) return [];
    // * Native ratio: button (36px) = 1.5 × icon (24px) — keep the icon proportionally smaller.
    const iconPx = `calc(${px} / 1.5)`;
    return [
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton { width: ${px} !important; height: ${px} !important; min-width: 0 !important; min-height: 0 !important; padding: 0 !important; border-radius: 50% !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton .ytSpecButtonShapeNextIcon { width: ${iconPx} !important; height: ${iconPx} !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton .ytSpecButtonShapeNextIcon .ytIconWrapperHost { width: ${iconPx} !important; height: ${iconPx} !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton { position: relative !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton yt-touch-feedback-shape { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; border-radius: 50% !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton yt-touch-feedback-shape .ytSpecTouchFeedbackShapeHoverEffect { border-radius: 50% !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton yt-touch-feedback-shape .ytSpecTouchFeedbackShapeStroke { border-radius: 50% !important; }`,
        `.ytLockupMetadataViewModelMenuButton button.ytSpecButtonShapeNextIconButton yt-touch-feedback-shape .ytSpecTouchFeedbackShapeFill { border-radius: 50% !important; }`,
    ];
}

/**
 * Aggregates all grid-styling CSS (title/meta + avatar + menu-button) from the styling slice.
 *
 * @param slice - The styling settings slice (StylingSettings).
 * @returns CSS rule strings.
 */
function gridStylingCss(slice: unknown): string[] {
    const s = slice as StylingSettings;
    return [...titleMetaCss(s), ...avatarCss(s), ...menuButtonCss(s)];
}

/**
 * Grid-styling feature: title/meta/avatar/menuButton CSS for grid-bearing pages.
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (captured 2026-08-09, locale=de)
 *   Selectors .ytLockupMetadataViewModelStandard / .ytContentMetadataViewModelMetadataText →
 *   light DOM. Shadow-DOM-Grenze: ytd-rich-item-renderer internals (not needed for CSS).
 * ~ DECISION-LOG: title text-align applied to h3+a+span (YT may render span as block); display
 *   NOT overridden (breaks -webkit-line-clamp). TextContainer width:100% required so text-align
 *   centers within full container width, not intrinsic content width.
 * * metaLayout:"split" companion CSS lives here (styling slice owner); the break-element DOM
 *   pass lives in the meta-split feature (core/meta-split.ts) — registered AFTER text-shorten
 *   so its marker-fallback anchor is set within the same registry pass. This feature keeps
 *   only the shared restore (styling.enabled toggle removes the breaks).
 */
export const gridStylingFeature: Feature = {
    id: "grid-styling",
    settingsPath: "styling",
    pages: {
        home: { css: (slice) => gridStylingCss(slice), restore: restoreMetaSplit },
        subscriptions: { css: (slice) => gridStylingCss(slice), restore: restoreMetaSplit },
        channel: { css: (slice) => gridStylingCss(slice), restore: restoreMetaSplit },
    },
    liveApplyKeys: [
        "styling.enabled",
        "styling.titleSize",
        "styling.metaSize",
        "styling.metaSpacing",
        "styling.titleMaxLines",
        "styling.titleAlign",
        "styling.metaAlign",
        "styling.metaLayout",
        "styling.metaStatsGap",
        "styling.avatar.enabled",
        "styling.avatar.hide",
        "styling.avatar.size",
        "styling.avatar.margin",
        "styling.menuButton.enabled",
        "styling.menuButton.hide",
        "styling.menuButton.size",
        "styling.forceEqualHeight",
    ],
    validate: validateStyling,
};
