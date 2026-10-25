// ─────────────────────────────────────────────────────────────────────────────
// MARK: Constants — default settings + persistence
// ─────────────────────────────────────────────────────────────────────────────

/** GM storage key for the persisted settings JSON. */
export const SETTINGS_KEY = "ytTweaksSettings";
/** GM storage key for the persisted settings-panel position (drag/resize result). */
export const PANEL_POS_KEY = "ytTweaksPanelPos";
/** GM storage key for the persisted panel UI state (active category + scroll position). */
export const PANEL_UI_KEY = "ytTweaksPanelUi";

/** Avatar (channel icon) styling settings for grid items. */
export interface AvatarSettings {
    enabled: boolean;
    hide: boolean;
    size: "xsmall" | "small" | "medium" | "large" | "xlarge";
    margin: string;
}

/** Menu button (3-dot "more actions") styling settings for grid items. */
export interface MenuButtonSettings {
    enabled: boolean;
    hide: boolean;
    size: "xsmall" | "small" | "medium" | "large" | "xlarge";
}

/** Masthead (topbar) settings — buttons, search bar, notifications, custom shortcuts. */
export interface MastheadSettings {
    enabled: boolean;
    hideCreateButton: boolean;
    hideMicButton: boolean;
    // * Hide the search button (arose from the old searchButton enum due to migration).
    hideSearchButton: boolean;
    searchWidthPct: number;
    hideNotification: "default" | "always" | "empty";
    // * Hide the hamburger icon (3-line menu button) — only the icon, NOT the guide pane.
    //   Guide sidebar visibility is controlled separately in the guide group.
    hideHamburger: boolean;
    // * Custom buttons — per button: "none" (off) | "left" (next to logo) | "right" (next to Create)
    historyButton: "none" | "left" | "right";
    subscriptionsButton: "none" | "left" | "right";
    playlistsButton: "none" | "left" | "right";
    watchLaterButton: "none" | "left" | "right";
    likedVideosButton: "none" | "left" | "right";
    myVideosButton: "none" | "left" | "right";
    downloadsButton: "none" | "left" | "right";
    // * Settings button — analogous to the custom buttons, opens the settings panel (no SPA nav).
    settingsButton: "none" | "left" | "right";
    // * Button order — array of button keys in display order (drag-and-drop in the GUI).
    //   Missing keys are appended, unknown keys ignored (robust against settings migration).
    buttonOrder: string[];
    // * Spacing — distance logo→left buttons, and between buttons
    logoSpacing: string;
    buttonSpacing: string;
    rightSpacing: string;
    leftBarAlign: "logo" | "center" | "search";
    rightBarAlign: "search" | "center" | "buttons";
    // * Hover opacity: idle opacity of the entire top row (0-100%). <100 = subdued, on hover/focus → 100%.
    toprowOpacityIdle: number;
    // * Animation speed of the opacity transition in ms. 0 = instant (transition: none).
    toprowAnimSpeed: number;
}

/**
 * Grid-item metadata styling settings (title + meta typography, avatar, menu, masthead).
 *
 * Typography hardening (ADR 0006): font-size + line-height are consumed as coupled preset
 * pairs (`titleSize`/`metaSize`, XS–XL) — free-form rem inputs broke the line-clamp /
 * min-height-calc invariants when the pair was pathologically mismatched. Margins are
 * removed entirely (asymmetric left/right margins made center-align look off);
 * `metaSpacing` (padding-top) is a 3-step enum.
 */
export interface StylingSettings {
    enabled: boolean;
    // * Typography presets — font-size+line-height as a coupled pair (grid-styling maps).
    titleSize: "xsmall" | "small" | "medium" | "large" | "xlarge";
    metaSize: "xsmall" | "small" | "medium" | "large" | "xlarge";
    // * Meta spacing above (padding-top): tight | normal | relaxed.
    metaSpacing: "tight" | "normal" | "relaxed";
    titleMaxLines: string;
    titleAlign: "start" | "center" | "end" | "justify";
    metaAlign: "left" | "center" | "right" | "block";
    // * Meta line layout: "mixed" = YT-native (names + views + date in ONE flowing row),
    //   "split" = names in line 1, views+date in a dedicated line 2 (break-element DOM pass).
    metaLayout: "mixed" | "split";
    // * Views<->date gap in line 2 (only metaLayout:"split"): 3-step enum (ADR 0006).
    metaStatsGap: "tight" | "normal" | "relaxed";
    avatar: AvatarSettings;
    menuButton: MenuButtonSettings;
    masthead: MastheadSettings;
    // * Force equal height: reserve max-lines worth of title space so all items in a row are
    //   equally tall regardless of actual title length (1-line vs 3-line titles).
    forceEqualHeight: boolean;
}

/** View-count formatting policy (rounding mode, decimals, unit suffixes). */
export interface ViewsSettings {
    roundMode: "round" | "truncate";
    decimals: number;
    suffixes: { k: string; M: string; B: string; T: string };
}

/** Text-shortening settings (view counts + relative dates + meta icons). */
export interface TextShortenSettings {
    shortenViews: boolean;
    shortenDate: boolean;
    // * Views word policy: "none" = number only (the icon carries the meaning), "locale" = number +
    //   locale-dependent word (de "Aufrufe", en "views"). Replaces the old free-text viewsText field.
    viewsWordMode: "none" | "locale";
    // * Meta icons: eye before the views number, clock before the date — ::before via mask-image (pure CSS).
    //   sizeEm applies to both icons (one shared size, consistent line height).
    icons: { viewsIcon: boolean; dateIcon: boolean; sizeEm: number };
    views: ViewsSettings;
    dateFormats: {
        years: string;
        months: string;
        weeks: string;
        days: string;
        hours: string;
        minutes: string;
    };
}

/** Ads group: Premium banner, big-screen/promoted, and member-only content (DOM pass). */
export interface AdsPromoSettings {
    enabled: boolean;
    hidePremiumBanner: boolean;
    hideBigScreenAds: boolean;
    hideMemberOnly: boolean;
}

/** Ads group: recommendation shelves (discover, shorts, gaming) — all pure CSS :has(). */
export interface AdsShelvesSettings {
    enabled: boolean;
    hideDiscoverSection: boolean;
    // * Hide the Shorts shelf on grid pages (the horizontal "Shorts" row of vertical short videos).
    //   No robust attribute on the shelf — detected via title text "Shorts" (not localized by YT),
    //   hidden via a DOM pass (inline display:none on the outer rich-section, Observer-backstopped
    //   on Polymer re-renders). Hides the outer rich-section so no grid gap remains.
    hideShortsShelf: boolean;
    // * Hide gaming shelves ("Die besten Livespiele" etc. — ytd-rich-shelf-renderer wrapping
    //   ytd-game-card-renderer). Re-render-safe pure CSS :has() on the outer rich-section —
    //   game-card element match, language-independent, no false positives on normal video shelves.
    hideGameShelves: boolean;
    // * Hide dynamic gaming shelves ("Mehr von diesem Spiel" — game-related video recommendations
    //   in a ytd-rich-shelf-renderer with the has-rounded-box-art-thumbnail-style attribute).
    //   Distinct from hideGameShelves (which targets the game-tile shelf via ytd-game-card-renderer):
    //   these shelves contain normal video items, not game tiles — identified by the box-art
    //   thumbnail-style attribute. Re-render-safe pure CSS :has() + attribute selector.
    hideDynamicGameShelves: boolean;
    // * Hide the Playables shelf ("Instant-Games, keine Downloads" — ytd-rich-shelf-renderer
    //   wrapping ytd-mini-game-card-view-model portrait game cards, links to /playables).
    //   Distinct from hideGameShelves (game-tile shelf via ytd-game-card-renderer) and
    //   hideDynamicGameShelves (box-art video shelves): Playables uses its own card view-model.
    //   Re-render-safe pure CSS :has() on the outer rich-section — element match,
    //   language-independent, no false positives on normal video shelves.
    hidePlayablesShelf: boolean;
    // * Hide the "Continue watching" shelf ("Weiter ansehen" — resume-watching items whose links
    //   carry a &t= resume timestamp inside a ytd-rich-shelf-renderer). No dedicated element or
    //   attribute — identified via the resume-timestamp link pattern (language-independent, but
    //   a shelf containing ANY partially-watched video with a &t= link would match too).
    //   Re-render-safe pure CSS :has() + attribute selector on the outer rich-section — hides
    //   the outer wrapper so no grid gap remains.
    hideContinueWatchingShelf: boolean;
}

/** Ads group: inline star-rating survey. */
export interface AdsSurveySettings {
    enabled: boolean;
    // * Hide the inline star-rating survey ("Wie hat dir dieses Video gefallen?") wrapped in a
    //   ytd-rich-section-renderer. Re-render-safe pure CSS :has() on the outer rich-section —
    //   element match (ytd-inline-survey-renderer), language-independent, hides the outer wrapper
    //   (no grid gap). Console-validated: grid closes cleanly, no reserved row.
    hideInlineSurvey: boolean;
}

/**
 * Ads/promo hiding — three gated groups, each with its own Super-Switch (`enabled`).
 *
 * Mirrors the `styling.avatar.enabled` nested-enable pattern. The `ads-hide` feature gates each
 * group's CSS/run on the group's `enabled` flag (group off → no rules/no DOM pass for that group).
 *
 * MIGRATION: the pre-revisit shape was a flat object (`ads.hidePremiumBanner`, etc.). loadSettings
 * detects flat-saved `ads` and maps the booleans into the matching group with `enabled: true`.
 */
export interface AdsSettings {
    promo: AdsPromoSettings;
    shelves: AdsShelvesSettings;
    survey: AdsSurveySettings;
}

/**
 * Auto-Sync Badge settings — the "Auto-synced" badge in the metadata-badge row per grid item.
 *
 * - mode: `original` (as-is) | `hidden` (display:none) | `integrated-start` (SVG+divider before
 *   the views row) | `integrated-end` (SVG+divider after the date row).
 * - iconSizeEm: size of the integrated mini-icon in em (relative to the meta line).
 * - divider: separator between SVG and meta texts (e.g. "•").
 */
export interface AutoSyncBadgeSettings {
    enabled: boolean;
    mode: "original" | "hidden" | "integrated-start" | "integrated-end";
    iconSizeEm: number;
    divider: string;
}

/**
 * Dim-Watched settings — desaturates + fades thumbnails of watched videos.
 *
 * - brightness: opacity preset for the grayscale + fade effect — subtle / light / medium / strong.
 * - hoverReveal: when true, hovering a watched item removes the dim (full color + opacity restored).
 * - progressSteps: quantization of the dim strength by watch progress (ADR 0001 marker values).
 *   `off` = legacy behavior (every watched item gets the full veil). Otherwise the watched
 *   progress (read from the thumbnail progress-bar segment width) is floored into buckets:
 *   `quarter` → 25/50/75/100 %, `third` → 33/66/100 %, `half` → 50/100 %. Each bucket scales
 *   the brightness veil by a progress factor — a half-watched video is dimmed less than a
 *   fully-watched one. Items below the first step get no veil at all.
 * - stepIntensity: how strongly the LOWER buckets are dimmed relative to the full veil
 *   (bug #5 fix). A linear bucket factor made the 25% bucket nearly invisible. The intensity
 *   enum bends the curve with ROOT exponents (medium = square root, strong = cube root) —
 *   higher intensities raise the mid buckets aggressively toward the full veil. Only
 *   effective when progressSteps ≠ off.
 */
export interface DimWatchedSettings {
    enabled: boolean;
    brightness: "subtle" | "light" | "medium" | "strong";
    hoverReveal: boolean;
    progressSteps: "off" | "quarter" | "third" | "half";
    stepIntensity: "subtle" | "medium" | "strong";
}

/**
 * Hide-Elements settings — hides native YouTube elements inside grid-item lockups.
 *
 * - hideVerifiedBadge: the "Bestätigtes Original-Konto" checkmark inline icon in the channel-name
 *   link (`.ytAttributedStringInlineBlockMod` slot). Slot-based hide: when YT renders a
 *   different inline icon in the same slot (e.g. the music note), it is hidden as well —
 *   the SVG content is not distinguishable via CSS (aria-label is empty).
 */
export interface HideElementsSettings {
    enabled: boolean;
    hideVerifiedBadge: boolean;
}

/**
 * Preview-delay settings — delays the inline hover-preview player on grid items.
 *
 * - `delayMs`: additional delay in milliseconds applied on top of YouTube's native
 *   ~86ms hover→video delay. 0 = off (native behavior, no gate). Enum values: see
 *   `VALID_DELAYS` in features/preview-delay.ts (0, 500, 750, 1000, 1250, 1500, 2000,
 *   3000, 5000, 8000, 10000).
 * * The delay only ADDS to the native delay — it cannot make the preview appear faster.
 * * Implementation: a CSS gate (`#video-preview { visibility: hidden }` — kept in the render
 *   tree so the video can buffer) suppresses the preview while active; per-item `pointerenter`
 *   listeners lift the gate after the chosen delay (NO pointerleave — the preview overlay
 *   would instantly re-trigger it). See features/preview-delay.ts.
 */
export interface PreviewDelaySettings {
    enabled: boolean;
    delayMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Guide-Sidebar-Settings
// ─────────────────────────────────────────────────────────────────────────────
// * The left sidebar pane (guide + mini-guide). Strictly separated from the masthead:
//   the masthead group controls only the hamburger icon, the guide group controls only the pane.

/** Guide visibility mode — controls the sidebar pane (NOT the hamburger icon). */
export type GuideVisibility = "default" | "hide-override" | "hide-forced";

/**
 * Guide width preset — enum replaces the old numeric `width.mini`/`width.full` sliders.
 *
 * - `default` — YT-native 240px (no CSS/JS mutation).
 * - `compact` — 200px (CSS width-override + content-offset-override).
 * - `large`   — 280px (wider than default).
 */
export type GuideWidthPreset = "default" | "compact" | "large";

/** Guide sidebar settings — the left sidebar pane (guide/mini-guide). */
export interface GuideSettings {
    enabled: boolean;
    // * Behavior (visibility)
    //   default       — YT-native, no mutation.
    //   hide-override — guide force-hidden, hamburger click opens/closes natively (observed by the FSM).
    //   hide-forced   — guide + mini-guide force-hidden via attribute removal, no override.
    visibility: GuideVisibility;
    // * Styling — width as an enum preset (see GuideWidthPreset).
    width: GuideWidthPreset;
    //   showIcon=false — hide entry icons in the EXPANDED guide (text only).
    showIcon: boolean;
    //   miniText=false — mini-guide native (icon on top, text below, vertical).
    //   miniText=true  — hide entry titles, mini-guide icons only (72px mode).
    //     Only takes effect with visibility=default (the mini-guide is hidden anyway in
    //     hide-override/hide-forced).
    miniText: boolean;
    // * "Mehr anzeigen" expander control (global, not per-group).
    //   showMoreButton=true — "Mehr anzeigen" button visible (YT-native).
    //   showMoreButton=false — hide the button (all expanders hidden).
    //   showMoreDefault=true — default behavior: expander expanded (auto-expand).
    //   showMoreDefault=false — default behavior: expander collapsed (YT-native).
    //   (Curated defaults live in DEFAULT_SETTINGS — see ADR 0007.)
    showMoreButton: boolean;
    showMoreDefault: boolean;
    //   showFooter=true — guide footer (Info/Presse/.../Copyright) visible.
    //   showFooter=false — hide the footer (CSS display:none).
    showFooter: boolean;
    // * Entries — per YT guide entry: hidden flag + order array (drag-and-drop in the GUI).
    //   entries.hidden.<key> = true → hide the entry (storage semantics; the UI toggle inverts).
    //   groups.hidden.<id> = true → hide the whole group (section including title).
    //   groups.order: group order (drag-and-drop). Empty → default order.
    entries: {
        hidden: Record<string, boolean>;
        order: string[];
        groups: {
            hidden: Record<string, boolean>;
            order: string[];
        };
    };
}

/** Debug/diagnostics settings (log verbosity, auto-open panel for dev). */
export interface DebugSettings {
    logLevel: "debug" | "info" | "warn" | "error" | "silent";
    autoOpen: boolean;
}

/** Settings panel GUI settings (size, backdrop opacity, GUI locale, position-max-age). */
export interface GuiSettings {
    widthPct: number;
    heightPct: number;
    backdropOpacity: number;
    locale: string;
    // * Max age of the persisted panel position in hours. 0 = always default (centered).
    //   On open: restore only if Date.now() - savedAt <= posMaxAgeHours * 3600_000.
    posMaxAgeHours: number;
}

/**
 * Color selection mode for a chip color setting: enum preset or custom hex.
 *
 * `default` = no override (YT-native). Other preset values map to fixed CSS colors.
 * `custom` = use the accompanying `*Hex` field (validated as `#rgb`/`#rrggbb`/`#rrggbbaa`).
 */
export type ChipColorMode = "default" | "red" | "blue" | "green" | "purple" | "orange" | "custom";

/**
 * Watch-page related-chip-bar color override settings (active + inactive chip color).
 *
 * The watch page's related-video sidebar has its own filter-chip bar
 * (DOM: `yt-related-chip-cloud-renderer` wrapping `yt-chip-cloud-chip-renderer` — "Alle /
 * Ähnlich / Empfehlungen / …"; verified via user-provided HTML 2026-08-28). The chip DOM is
 * structurally identical to the homepage chips (same `yt-chip-cloud-chip-renderer` +
 * `ytChipShapeActive`/`ytChipShapeInactive` classes), so the CSS model mirrors `FeedChipsSettings`.
 *
 * - `activeColor`/`activeColorHex`: background of the selected chip (+ `color:#fff`).
 * - `inactiveColor`/`inactiveColorHex`: background of non-selected chips (text untouched).
 * - `layout`: `"collapse"` = YT-native carousel (arrows + translateX clipping on overflow),
 *   `"stack"` = wrapping chip list (arrows off, carousel transform off, chips flex-wrap:
 *   several per line when they fit, otherwise wrap — dense, not one-per-line),
 *   `"hide"` = chip bar removed entirely (`display:none`).
 * - The `*Hex` fields are only in effect when the corresponding mode is `"custom"`; the feature
 *   validator rejects invalid hex (regex `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`).
 */
/** Chip-bar layout mode: `collapse` = YT-native carousel, `stack` = wrapping flex list, `hide` = bar removed entirely. */
export type ChipLayout = "collapse" | "stack" | "hide";

export interface WatchChipsSettings {
    enabled: boolean;
    /** Active (selected) chip color mode (preset or custom hex). */
    activeColor: ChipColorMode;
    /** Custom hex for the active chip — only used when `activeColor === "custom"`. */
    activeColorHex: string;
    /** Inactive (non-selected) chip color mode (preset or custom hex). */
    inactiveColor: ChipColorMode;
    /** Custom hex for inactive chips — only used when `inactiveColor === "custom"`. */
    inactiveColorHex: string;
    /** Layout mode: `collapse` = YT-native carousel, `stack` = wrapping flex list. */
    layout: ChipLayout;
}

/**
 * Homepage feed-filter-chip color override settings (active + inactive chip color).
 *
 * Chips are the "Alle / Gaming / Musik / ..." row under the search bar on the YouTube homepage
 * (DOM: `yt-chip-cloud-chip-renderer` inside `iron-selector#chips` — verified via live-probe,
 * 2026-08-23; the legacy `ytd-feed-filter-chip-renderer` no longer exists). The visible
 * background surface is the inner `<div class="ytChipShapeChip ytChipShapeActive|Inactive">`
 * (verified via live-DOM dump 2026-08-26).
 *
 * - `activeColor`/`activeColorHex`: background of the selected chip. `color:#fff` is applied
 *   alongside the background so text stays readable on colored backgrounds (dark+light).
 * - `inactiveColor`/`inactiveColorHex`: background of non-selected chips. No `color` override
 *   (YT-native text color stays) — only the background is tinted.
 *
 * The `*Hex` fields are only in effect when the corresponding mode is `"custom"`; the feature
 * validator rejects invalid hex (regex `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`).
 */
export interface FeedChipsSettings {
    enabled: boolean;
    /** Active (selected) chip color mode (preset or custom hex). */
    activeColor: ChipColorMode;
    /** Custom hex for the active chip — only used when `activeColor === "custom"`. */
    activeColorHex: string;
    /** Inactive (non-selected) chip color mode (preset or custom hex). */
    inactiveColor: ChipColorMode;
    /** Custom hex for inactive chips — only used when `inactiveColor === "custom"`. */
    inactiveColorHex: string;
    /** Layout mode: `collapse` = YT-native carousel, `hide` = bar removed (no `stack` on home — the
     *  home chip bar is a 0-height overlay whose wrapped content overlaps the grid; CSS cannot
     *  push the grid below wrapped chips, verified via live-probe 2026-08-28). */
    layout: Exclude<ChipLayout, "stack">;
}

/**
 * Grid-column-count preset for the Startpage category (homepage + other grid pages).
 *
 * `"default"` = YT-native responsive (no override), `"1"`–`"10"` = fixed column count,
 * `"custom"` = numeric input via `customColumns`. Number presets are string-enum values
 * (Select stores strings; the feature resolves them via a typed PRESET map).
 */
export type GridColumnsPreset = "default" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "custom";

/**
 * Watch-page action-button visibility mode: "standard" (visible, YT-native) or
 * "verstecken" (hidden via display:none / inline-style).
 */
export type WatchActionButtonMode = "standard" | "verstecken";

/**
 * Watch-page collapsed-description line-count preset — overrides the `#snippet`
 * `max-height` inside `ytd-text-inline-expander` (2rem per line). "3" matches YT's
 * native default (6rem) and emits no override.
 */
export type WatchDescriptionLines = "2" | "3" | "4" | "5";

/**
 * Watch-page layout settings — metadata & action buttons of `ytd-watch-metadata`
 * (the `/watch` page above-the-fold region).
 *
 * - `hideMemberButton`: hide the "Mitglied werden" / "Join" button (`#sponsor-button`
 *   inside `ytd-video-owner-renderer`).
 * - `hideLikeDislike`: hide the entire segmented like+dislike block
 *   (`segmented-like-dislike-button-view-model`).
 * - `shareButton` / `saveButton` / `downloadButton`: per-button enum
 *   ("standard"|"verstecken"). Share/Save are matched via a locale-aware JS DOM pass
 *   (aria-label text-match); Download is language-independent (custom element, pure CSS).
 * - `descriptionClickFold`: click on the description background toggles expand/collapse
 *   (links & buttons excluded) — single capture listener delegated on `document`
 *   (re-render-immune), plus a theme-color hover rule for the expanded box (CSS).
 * - `descriptionLines`: collapsed snippet line count (`#snippet` max-height override).
 */
export interface WatchPageSettings {
    enabled: boolean;
    hideMemberButton: boolean;
    hideLikeDislike: boolean;
    shareButton: WatchActionButtonMode;
    saveButton: WatchActionButtonMode;
    downloadButton: WatchActionButtonMode;
    descriptionClickFold: boolean;
    descriptionLines: WatchDescriptionLines;
}

/**
 * Startpage settings — overrides the number of video columns on the homepage grid.
 *
 * - `columnsPreset`: `"default"` emits no CSS override (YT-native responsive);
 *   `"1"`–`"10"` set `--ytd-rich-grid-items-per-row` on `ytd-rich-grid-renderer`
 *   to the chosen fixed count; `"custom"` defers to `customColumns`.
 * - `customColumns`: numeric column count used only when `columnsPreset === "custom"`.
 *   Clamped to [1, 10] in the feature CSS; validated against the same range.
 */
export interface StartpageSettings {
    enabled: boolean;
    columnsPreset: GridColumnsPreset;
    customColumns: number;
}

/** System-level toggles (global kill-switch + anonymize layer). */
export interface SystemSettings {
    // * Global kill-switch: when false, the observer stops, the tweak stylesheet is removed,
    //   and all DOM mutations are restored to YouTube's original state. Persists in the settings
    //   JSON (migrated from the legacy separate GM key `ytTweaksEnabled`).
    tweaksEnabled: boolean;
    // * Anonymize layer: CSS-only blur over sensitive texts + avatars (screenshots without
    //   identifying data). Independent of `tweaksEnabled` (survives kill-switch-off).
    anonymize: boolean;
    // * Blur strength in px applied by the anonymize layer. Applied to text as-is; images
    //   (thumbnails, avatars, video) get 1.5x (faces/images need more to be unrecognizable).
    //   Stepper: 2-50. (Curated default lives in DEFAULT_SETTINGS — ADR 0007.)
    anonymizeBlur: number;
}

/** Root settings shape — single source of truth, persisted via GM_setValue. */
export interface Settings {
    styling: StylingSettings;
    textShorten: TextShortenSettings;
    ads: AdsSettings;
    autoSyncBadge: AutoSyncBadgeSettings;
    dimWatched: DimWatchedSettings;
    hideElements: HideElementsSettings;
    previewDelay: PreviewDelaySettings;
    guide: GuideSettings;
    feedChips: FeedChipsSettings;
    watchChips: WatchChipsSettings;
    startpage: StartpageSettings;
    watchPage: WatchPageSettings;
    debug: DebugSettings;
    gui: GuiSettings;
    system: SystemSettings;
}

/** Default settings used on first load, reset, and as the deep-merge base for saved values.
 *
 * ~ CURATED DEFAULTS (ADR 0007): the shipped defaults are the author's own setup — an
 *   opinionated "this is how YouTube should look" baseline (split meta rows, centered
 *   titles, ads/promo shelves hidden, guide hidden, red chips, …) instead of a
 *   YT-native opt-in baseline. Saved settings always win over these defaults
 *   (deepMergeSettings), so existing installs are never silently re-styled.
 */
export const DEFAULT_SETTINGS: Settings = {
    styling: {
        enabled: true,
        titleSize: "medium",
        metaSize: "medium",
        metaSpacing: "normal",
        titleMaxLines: "3",
        titleAlign: "center",
        metaAlign: "center",
        metaLayout: "split",
        metaStatsGap: "normal",
        avatar: {
            enabled: true,
            hide: true,
            size: "medium",
            margin: "12px",
        },
        menuButton: {
            enabled: true,
            hide: false,
            size: "large",
        },
        forceEqualHeight: true,
        masthead: {
            enabled: true,
            hideCreateButton: true,
            hideMicButton: true,
            hideSearchButton: true,
            searchWidthPct: 30,
            hideNotification: "default",
            hideHamburger: false,
            historyButton: "left",
            subscriptionsButton: "left",
            playlistsButton: "none",
            watchLaterButton: "left",
            likedVideosButton: "none",
            myVideosButton: "none",
            downloadsButton: "none",
            settingsButton: "right",
            buttonOrder: [
                "subscriptions",
                "history",
                "watchLater",
                "playlists",
                "likedVideos",
                "myVideos",
                "downloads",
                "settings",
            ],
            logoSpacing: "1.3rem",
            buttonSpacing: "0.25rem",
            rightSpacing: "1.3rem",
            leftBarAlign: "logo",
            rightBarAlign: "buttons",
            toprowOpacityIdle: 100,
            toprowAnimSpeed: 150,
        },
    },
    textShorten: {
        shortenViews: true,
        shortenDate: true,
        viewsWordMode: "none",
        icons: { viewsIcon: true, dateIcon: true, sizeEm: 0.9 },
        views: {
            roundMode: "round",
            decimals: 1,
            suffixes: { k: "k", M: "M", B: "B", T: "T" },
        },
        dateFormats: {
            years: "Y",
            months: "M",
            weeks: "W",
            days: "D",
            hours: "h",
            minutes: "m",
        },
    },
    ads: {
        promo: {
            enabled: true,
            hidePremiumBanner: true,
            hideBigScreenAds: true,
            hideMemberOnly: true,
        },
        shelves: {
            enabled: true,
            hideDiscoverSection: true,
            hideShortsShelf: true,
            hideGameShelves: true,
            hideDynamicGameShelves: true,
            hidePlayablesShelf: true,
            hideContinueWatchingShelf: true,
        },
        survey: {
            enabled: true,
            hideInlineSurvey: true,
        },
    },
    autoSyncBadge: {
        enabled: true,
        mode: "integrated-end",
        iconSizeEm: 1.1,
        divider: "•",
    },
    dimWatched: {
        enabled: true,
        brightness: "medium",
        hoverReveal: true,
        progressSteps: "third",
        stepIntensity: "medium",
    },
    hideElements: {
        enabled: true,
        hideVerifiedBadge: true,
    },
    previewDelay: {
        enabled: true,
        delayMs: 1250,
    },
    guide: {
        enabled: true,
        visibility: "hide-override",
        width: "large",
        showIcon: true,
        miniText: true,
        showMoreButton: true,
        showMoreDefault: true,
        showFooter: false,
        entries: {
            hidden: {},
            order: [
                "shorts",
                "home",
                "subscriptions",
                "playlists",
                "myYouTube",
                "history",
                "watchLater",
                "likedVideos",
                "myChannel",
                "downloads",
                "myVideos",
                "ytPremium",
                "ytMusic",
                "ytKids",
                "music",
                "live",
                "moviesShows",
                "reportHistory",
            ],
            groups: { hidden: {}, order: ["main", "myYouTube", "subscriptions", "discover", "moreFromYT", "system"] },
        },
    },
    feedChips: {
        enabled: true,
        activeColor: "red",
        activeColorHex: "#ff0033",
        inactiveColor: "red",
        inactiveColorHex: "#666666",
        layout: "collapse",
    },
    watchChips: {
        enabled: true,
        activeColor: "red",
        activeColorHex: "#ff0033",
        inactiveColor: "red",
        inactiveColorHex: "#666666",
        layout: "stack",
    },
    startpage: { enabled: true, columnsPreset: "7", customColumns: 6 },
    watchPage: {
        enabled: true,
        hideMemberButton: true,
        hideLikeDislike: false,
        shareButton: "verstecken",
        saveButton: "verstecken",
        downloadButton: "verstecken",
        descriptionClickFold: true,
        descriptionLines: "3",
    },
    debug: { logLevel: "silent", autoOpen: false },
    gui: { widthPct: 55, heightPct: 75, backdropOpacity: 20, locale: "auto", posMaxAgeHours: 25 },
    system: { tweaksEnabled: true, anonymize: false, anonymizeBlur: 4 },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deep-merges saved values over defaults, recursively to arbitrary depth.
 *
 * Missing or non-object saved values fall back to the default. Array defaults are not recursed
 * (the saved scalar wins, if present).
 *
 * @param defaults - The default object (drives which keys are valid).
 * @param saved    - The persisted object (may be partial / malformed).
 * @returns A new object of type T with defaults overridden by valid saved values.
 */
export function deepMergeSettings<T>(defaults: T, saved: unknown): T {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defaults as Record<string, unknown>)) {
        const dv = (defaults as Record<string, unknown>)[key];
        const sv =
            saved &&
            typeof saved === "object" &&
            saved !== null &&
            (saved as Record<string, unknown>)[key] !== undefined
                ? (saved as Record<string, unknown>)[key]
                : undefined;
        if (dv && typeof dv === "object" && !Array.isArray(dv)) {
            out[key] = deepMergeSettings(dv, sv && typeof sv === "object" ? sv : {});
        } else {
            out[key] = sv !== undefined ? sv : dv;
        }
    }
    return out as T;
}

/**
 * Loads settings from GM storage, deep-merged over defaults.
 *
 * On parse failure or shape mismatch, the relevant default is retained. Never throws.
 *
 * @returns A fully-formed Settings object.
 */
export function loadSettings(): Settings {
    const savedStr = GM_getValue(SETTINGS_KEY, "{}");
    const saved = JSON.parse(savedStr);
    const defaults: Settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    // * MIGRATION highlightUnseen → dimWatched (one-time, if dimWatched is not yet saved).
    //   enabled + brightness are carried over, colorSource/fixedColor discarded, dimColor default "black".
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).highlightUnseen &&
        !(saved as Record<string, unknown>).dimWatched
    ) {
        const old = (saved as Record<string, unknown>).highlightUnseen as Record<string, unknown>;
        const oldBrightness = typeof old.brightness === "string" ? old.brightness : "medium";
        (saved as Record<string, unknown>).dimWatched = {
            enabled: Boolean(old.enabled),
            brightness: oldBrightness,
        };
        delete (saved as Record<string, unknown>).highlightUnseen;
    }

    // * MIGRATION menuSidebarMode → hideHamburger + guide.visibility (one-time, if
    //   styling.masthead.menuSidebarMode is still saved).
    //   The old 3-mode enum is split into two strictly separated settings:
    //   - hideHamburger (masthead group): controls only the hamburger icon.
    //   - guide.visibility (guide group): controls only the sidebar pane.
    //   Mapping:
    //     standard → hideHamburger=false, guide.visibility=default
    //     hidden   → hideHamburger=true,  guide.visibility=hide-forced
    //     toggle   → hideHamburger=false, guide.visibility=hide-override
    //     minimal  → hideHamburger=false, guide.visibility=hide-override (Legacy)
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).styling &&
        typeof (saved as Record<string, unknown>).styling === "object"
    ) {
        const styling = (saved as Record<string, unknown>).styling as Record<string, unknown>;
        const masthead = styling.masthead as Record<string, unknown> | undefined;
        if (masthead && typeof masthead.menuSidebarMode === "string") {
            const oldMode = masthead.menuSidebarMode;
            // * hideHamburger is ALWAYS migrated from the old mode (masthead configuration).
            if (oldMode === "hidden") {
                masthead.hideHamburger = true;
            } else {
                masthead.hideHamburger = false;
            }
            // * guide.visibility is only set when the guide group does not exist yet
            //   (already-saved guide settings are not overwritten).
            if (!(saved as Record<string, unknown>).guide) {
                if (oldMode === "hidden") {
                    (saved as Record<string, unknown>).guide = { visibility: "hide-forced" };
                } else if (oldMode === "toggle" || oldMode === "minimal") {
                    (saved as Record<string, unknown>).guide = { visibility: "hide-override" };
                } else {
                    (saved as Record<string, unknown>).guide = { visibility: "default" };
                }
            }
            delete masthead.menuSidebarMode;
        }
    }

    // * MIGRATION searchButton enum ("default"|"hide") → hideSearchButton boolean (one-time, if
    //   styling.masthead.searchButton is still saved as a string). "hide" → true, otherwise false.
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).styling &&
        typeof (saved as Record<string, unknown>).styling === "object"
    ) {
        const styling = (saved as Record<string, unknown>).styling as Record<string, unknown>;
        const masthead = styling.masthead as Record<string, unknown> | undefined;
        if (masthead && typeof masthead.searchButton === "string") {
            masthead.hideSearchButton = masthead.searchButton === "hide";
            delete masthead.searchButton;
        }
    }

    // * MIGRATION styling.menuButton.margin → removed (one-time, if still saved).
    //   The field overrode the native container margin and made the button jump into the corner;
    //   the position is no longer overridden — delete only, no mapping needed.
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).styling &&
        typeof (saved as Record<string, unknown>).styling === "object"
    ) {
        const styling = (saved as Record<string, unknown>).styling as Record<string, unknown>;
        const menuButton = styling.menuButton as Record<string, unknown> | undefined;
        if (menuButton && "margin" in menuButton) {
            delete menuButton.margin;
        }
    }

    // * MIGRATION styling free-text rem typo → preset enums (ADR 0006, one-time, if
    //   free-text rem keys are still saved). Mapping:
    //   - titleFontSize/metaFontSize: exact default values → "medium"; otherwise the closest
    //     preset by font-size (values from the grid-styling preset maps).
    //   - metaPaddingTop: exactly "0.65rem" → "normal"; otherwise the closest spacing preset.
    //   - titleMarginLeft/Right + the old rem keys are discarded (delete, no mapping —
    //     margins no longer exist as a setting).
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).styling &&
        typeof (saved as Record<string, unknown>).styling === "object"
    ) {
        const styling = (saved as Record<string, unknown>).styling as Record<string, unknown>;
        if (typeof styling.titleFontSize === "string" || typeof styling.metaFontSize === "string") {
            const rem = (v: unknown): number | null => {
                if (typeof v !== "string") return null;
                // * Accept only pure rem values — other units (px, garbage) are not a valid
                //   old value and fall back to "medium" (no NaN mapping).
                if (!/^\d*\.?\d+rem$/.test(v.trim())) return null;
                const n = Number.parseFloat(v);
                return Number.isNaN(n) ? null : n;
            };
            const nearestPreset = (v: unknown, presets: [string, number][], fallback: string): string => {
                const n = rem(v);
                if (n === null) return fallback;
                let best = presets[0];
                let bestDist = Number.POSITIVE_INFINITY;
                for (const p of presets) {
                    const d = Math.abs(p[1] - n);
                    if (d < bestDist) {
                        best = p;
                        bestDist = d;
                    }
                }
                return best[0];
            };
            const titlePresets: [string, number][] = [
                ["xsmall", 1.1],
                ["small", 1.2],
                ["medium", 1.35],
                ["large", 1.5],
                ["xlarge", 1.65],
            ];
            const metaPresets: [string, number][] = [
                ["xsmall", 1.0],
                ["small", 1.08],
                ["medium", 1.15],
                ["large", 1.25],
                ["xlarge", 1.35],
            ];
            const spacingPresets: [string, number][] = [
                ["tight", 0.35],
                ["normal", 0.65],
                ["relaxed", 0.95],
            ];
            styling.titleSize = nearestPreset(styling.titleFontSize, titlePresets, "medium");
            styling.metaSize = nearestPreset(styling.metaFontSize, metaPresets, "medium");
            styling.metaSpacing = nearestPreset(styling.metaPaddingTop, spacingPresets, "normal");
            delete styling.titleFontSize;
            delete styling.titleLineHeight;
            delete styling.metaFontSize;
            delete styling.metaLineHeight;
            delete styling.metaPaddingTop;
            delete styling.titleMarginLeft;
            delete styling.titleMarginRight;
        }
    }

    // * MIGRATION textShorten.viewsText (free text) → viewsWordMode enum (one-time, if the
    //   old key is still saved). "" → "none" (number only), any non-empty text → "locale"
    //   (number + locale word). The free text itself is discarded — the locale word comes from
    //   LOCALE_PATTERNS (de "Aufrufe", en "views"), no longer from the settings.
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).textShorten &&
        typeof (saved as Record<string, unknown>).textShorten === "object"
    ) {
        const textShorten = (saved as Record<string, unknown>).textShorten as Record<string, unknown>;
        if ("viewsText" in textShorten) {
            textShorten.viewsWordMode =
                typeof textShorten.viewsText === "string" && textShorten.viewsText !== "" ? "locale" : "none";
            delete textShorten.viewsText;
        }
    }

    // * MIGRATION guide.width {mini,full} → guide.width GuideWidthPreset (one-time, if
    //   guide.width is still saved as an object {mini:number, full:number}).
    //   Mapping of the old numeric values (the full guide is authoritative):
    //     full === 0           → "default"  (no override, YT default 240px)
    //     full > 0 && < 220    → "compact"  (narrower than default → 200px)
    //     full >= 220          → "large"    (>= default, e.g. 240 without override or wider → 280px)
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).guide &&
        typeof (saved as Record<string, unknown>).guide === "object"
    ) {
        const guide = (saved as Record<string, unknown>).guide as Record<string, unknown>;
        const w = guide.width;
        if (w && typeof w === "object" && !Array.isArray(w)) {
            const wo = w as Record<string, unknown>;
            const full = typeof wo.full === "number" ? (wo.full as number) : 0;
            let preset: GuideWidthPreset;
            if (full <= 0) preset = "default";
            else if (full < 220) preset = "compact";
            else preset = "large";
            guide.width = preset;
        }
    }

    // * MIGRATION startpage.columnsPreset adjective enum ("small"/"large"/"xlarge") → numeric
    //   string enum ("2"/"4"/"5"), one-time if an old adjective value is still saved.
    //   "default"/"custom" and customColumns stay unchanged. Without the migration an old
    //   value would fall back to "Standard" in the Select (no match), while the feature
    //   still reacts to the old key → display ≠ effect.
    //   fixHeightByColumns (removed feature field) is NOT mapped — deepMerge
    //   silently discards unknown keys.
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).startpage &&
        typeof (saved as Record<string, unknown>).startpage === "object"
    ) {
        const startpage = (saved as Record<string, unknown>).startpage as Record<string, unknown>;
        const map: Record<string, string> = { small: "2", large: "4", xlarge: "5" };
        if (typeof startpage.columnsPreset === "string" && startpage.columnsPreset in map) {
            startpage.columnsPreset = map[startpage.columnsPreset];
        }
    }

    // * MIGRATION ads (flat {hideX: boolean}) → nested {promo:{enabled,hideX}, shelves:..., survey:...}
    //   One-time, if `saved.ads` still has the old flat shape (booleans directly under ads, not
    //   under a group sub-object). The old boolean values are mapped into the matching group,
    //   each group gets enabled:true (default behavior: group on as before — the individual
    //   hide flags determine as before whether something is hidden). An already-saved nested
    //   shape (ads.promo etc.) is not overwritten.
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).ads &&
        typeof (saved as Record<string, unknown>).ads === "object"
    ) {
        const ads = (saved as Record<string, unknown>).ads as Record<string, unknown>;
        // * Flat-shape detection: at least one hideX flag directly under ads (boolean),
        //   AND no group sub-object (promo/shelves/survey) present.
        const hasFlatFlag = [
            "hidePremiumBanner",
            "hideBigScreenAds",
            "hideMemberOnly",
            "hideDiscoverSection",
            "hideShortsShelf",
            "hideGameShelves",
            "hideDynamicGameShelves",
            "hidePlayablesShelf",
            "hideContinueWatchingShelf",
            "hideInlineSurvey",
        ].some((k) => typeof ads[k] === "boolean");
        const hasNested = !!ads.promo || !!ads.shelves || !!ads.survey;
        if (hasFlatFlag && !hasNested) {
            const b = (k: string): boolean | undefined =>
                typeof ads[k] === "boolean" ? (ads[k] as boolean) : undefined;
            ads.promo = {
                enabled: true,
                hidePremiumBanner: b("hidePremiumBanner") ?? true,
                hideBigScreenAds: b("hideBigScreenAds") ?? true,
                hideMemberOnly: b("hideMemberOnly") ?? true,
            };
            ads.shelves = {
                enabled: true,
                hideDiscoverSection: b("hideDiscoverSection") ?? false,
                hideShortsShelf: b("hideShortsShelf") ?? false,
                hideGameShelves: b("hideGameShelves") ?? false,
                hideDynamicGameShelves: b("hideDynamicGameShelves") ?? false,
                hidePlayablesShelf: b("hidePlayablesShelf") ?? false,
                hideContinueWatchingShelf: b("hideContinueWatchingShelf") ?? false,
            };
            ads.survey = {
                enabled: true,
                hideInlineSurvey: b("hideInlineSurvey") ?? true,
            };
            delete ads.hidePremiumBanner;
            delete ads.hideBigScreenAds;
            delete ads.hideMemberOnly;
            delete ads.hideDiscoverSection;
            delete ads.hideShortsShelf;
            delete ads.hideGameShelves;
            delete ads.hideDynamicGameShelves;
            delete ads.hidePlayablesShelf;
            delete ads.hideContinueWatchingShelf;
            delete ads.hideInlineSurvey;
        }
    }

    // * MIGRATION styling.titleMaxLines number → string (one-time, if saved as a number).
    //   titleMaxLines is a STRING enum ("1".."4", "99") — a saved number breaks the
    //   strict-equality check in grid-styling.ts and matches no Select option
    //   (display ≠ effect). Hand-edited settings imports stored 3 instead of "3".
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).styling &&
        typeof (saved as Record<string, unknown>).styling === "object"
    ) {
        const styling = (saved as Record<string, unknown>).styling as Record<string, unknown>;
        if (typeof styling.titleMaxLines === "number") {
            styling.titleMaxLines = String(styling.titleMaxLines);
        }
    }

    // * MIGRATION feedChips.layout "stack" → "collapse" (one-time, if still saved).
    //   The home chip bar does NOT support "stack" (0-height overlay — wrapped chips
    //   overlap the grid; see FeedChipsSettings.layout). A saved "stack" is silently
    //   ignored by the feature and matches no GUI option → normalize to "collapse".
    if (
        saved &&
        typeof saved === "object" &&
        (saved as Record<string, unknown>).feedChips &&
        typeof (saved as Record<string, unknown>).feedChips === "object"
    ) {
        const feedChips = (saved as Record<string, unknown>).feedChips as Record<string, unknown>;
        if (feedChips.layout === "stack") {
            feedChips.layout = "collapse";
        }
    }

    // * MIGRATION ytTweaksEnabled (separate GM key) → system.tweaksEnabled (settings object).
    //   One-time, if `saved.system.tweaksEnabled` is not yet set. The old variable lived in
    //   the separate GM key "ytTweaksEnabled" (string "true"/"false"), saved by the dev-only
    //   TM menu entry. The old GM key is NOT deleted (backward-compat for old
    //   installations, remains unused).
    if (saved && typeof saved === "object") {
        const sys = (saved as Record<string, unknown>).system;
        const sysObj = sys && typeof sys === "object" ? (sys as Record<string, unknown>) : undefined;
        const hasTweaksEnabled = sysObj && typeof sysObj.tweaksEnabled === "boolean";
        if (!hasTweaksEnabled) {
            // * Default true, if the old GM key was never set (GM_getValue returns "true").
            const legacy: string = GM_getValue("ytTweaksEnabled", "true");
            const tweaksEnabled = legacy !== "false";
            if (!sysObj) {
                (saved as Record<string, unknown>).system = { tweaksEnabled };
            } else {
                sysObj.tweaksEnabled = tweaksEnabled;
            }
        }
    }

    function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                const sourceIsObj =
                    source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key]);
                const targetIsObj =
                    target[key] !== null && typeof target[key] === "object" && !Array.isArray(target[key]);

                if (sourceIsObj && targetIsObj) {
                    deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
                } else if (!sourceIsObj && targetIsObj) {
                    // * TYPE CONFLICT: the default is an object, but a simple value was saved
                    //   -> ignore the old stored value, keep the default object
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    return deepMerge(defaults as unknown as Record<string, unknown>, saved) as unknown as Settings;
}

/**
 * Persists the given settings to GM storage as JSON.
 *
 * @param obj - The settings object to store.
 */
export function saveSettings(obj: Settings): void {
    GM_setValue(SETTINGS_KEY, JSON.stringify(obj));
}

/** Persisted settings-panel position (pixel coordinates from drag/resize + save timestamp). */
export interface PanelPos {
    top: number;
    left: number;
    // * Unix-ms timestamp of the save. On restore: use only if the age
    //   <= gui.posMaxAgeHours * 3600_000 ms. If the timestamp is missing (old saves) → ignored.
    savedAt?: number;
}

/**
 * Reads the persisted panel position from GM storage, gated by the max-age setting.
 *
 * Returns the position only if it is present, well-formed, AND its age (`Date.now() - savedAt`)
 * does not exceed `gui.posMaxAgeHours` hours. A `posMaxAgeHours` of 0 always returns null
 * (always use the default centered position).
 *
 * @param maxAgeHours - Max age in hours (from `gui.posMaxAgeHours`). 0 = never restore.
 * @returns The position, or null if absent / malformed / expired.
 */
export function getPanelPos(maxAgeHours: number): PanelPos | null {
    if (maxAgeHours <= 0) return null;
    const raw = GM_getValue(PANEL_POS_KEY, null);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.top !== "number" || typeof parsed.left !== "number") {
            return null;
        }
        const pos = parsed as PanelPos;
        // * savedAt missing (old saves without a timestamp) → stale, do not restore.
        if (typeof pos.savedAt !== "number") return null;
        const ageMs = Date.now() - pos.savedAt;
        if (ageMs > maxAgeHours * 3600_000) return null;
        return pos;
    } catch {
        return null;
    }
}

/**
 * Persists the settings-panel position to GM storage as JSON, stamped with the current timestamp.
 *
 * @param pos - The position to store (savedAt is set automatically if absent).
 */
export function savePanelPos(pos: PanelPos): void {
    if (typeof pos.savedAt !== "number") pos.savedAt = Date.now();
    GM_setValue(PANEL_POS_KEY, JSON.stringify(pos));
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Panel UI state (active category + scroll position)
// ─────────────────────────────────────────────────────────────────────────────
// * Persists the active tab + the content area's scroll position.
//   Survives panel close and page reload.

/** Persisted panel UI state: active category + content scroll position. */
export interface PanelUiState {
    /** Active category id (e.g. "video-item"). */
    activeCategory: string;
    /** Content scroll-top in pixels. */
    scrollTop: number;
}

/**
 * Reads the persisted panel UI state (active category + scroll position).
 *
 * @returns The state, or null if absent/malformed.
 */
export function getPanelUi(): PanelUiState | null {
    const raw = GM_getValue(PANEL_UI_KEY, null);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.activeCategory !== "string" || typeof parsed.scrollTop !== "number") {
            return null;
        }
        return parsed as PanelUiState;
    } catch {
        return null;
    }
}

/**
 * Persists the panel UI state (active category + scroll position) to GM storage.
 *
 * @param state - The UI state to store.
 */
export function savePanelUi(state: PanelUiState): void {
    GM_setValue(PANEL_UI_KEY, JSON.stringify(state));
}
