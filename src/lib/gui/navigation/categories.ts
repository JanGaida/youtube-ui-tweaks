// ─────────────────────────────────────────────────────────────────────────────
// MARK: Category definitions — 9 top-level navigation categories
// ─────────────────────────────────────────────────────────────────────────────
// * Replaces the old TABS definition in App.svelte. Each category maps to a set of
//   flat sections (rendered via Section.svelte) and an i18n label key + icon key.
// * Section ids become the `data-section` anchors for the CategorySidebar section list
//   and the scroll-spy.

/** i18n key prefix for category labels (e.g. "cat.video-item"). */
export type CategoryId =
    | "video-item"
    | "menubar"
    | "guide-sidebar"
    | "feed-chips"
    | "startpage"
    | "ads-promotions"
    | "watch-page"
    | "system"
    | "about";

/** A flat section within a category (id → i18n label key + scroll-spy anchor). */
export interface SectionDef {
    /** Section id — used as `data-section` anchor + scroll-spy target. */
    id: string;
    /** i18n label key (e.g. "sec.styling"). */
    labelKey: string;
    /** i18n description key (e.g. "sec.styling.desc") — optional, rendered under the title. */
    descKey?: string;
}

/** A top-level navigation category (sidebar entry). */
export interface CategoryDef {
    /** Category id — also the active-state key. */
    id: CategoryId;
    /** i18n label key (e.g. "cat.video-item"). */
    labelKey: string;
    /** Icon key into CAT_ICONS (icons.ts). */
    icon: CategoryId;
    /** Flat sections rendered in the content area when this category is active. */
    sections: SectionDef[];
}

/** All 9 categories in display order. */
export const CATEGORIES: CategoryDef[] = [
    {
        id: "video-item",
        labelKey: "cat.video-item",
        icon: "video-item",
        sections: [
            { id: "styling", labelKey: "sec.styling", descKey: "sec.styling.desc" },
            { id: "views", labelKey: "sec.views", descKey: "sec.views.desc" },
            { id: "date", labelKey: "sec.date", descKey: "sec.date.desc" },
            { id: "avatar", labelKey: "sec.avatar", descKey: "sec.avatar.desc" },
            { id: "menu-icon", labelKey: "sec.menu-icon", descKey: "sec.menu-icon.desc" },
            { id: "auto-sync-badge", labelKey: "sec.auto-sync-badge", descKey: "sec.auto-sync-badge.desc" },
            { id: "hide-elements", labelKey: "sec.hide-elements", descKey: "sec.hide-elements.desc" },
            { id: "dim-watched", labelKey: "sec.dim-watched", descKey: "sec.dim-watched.desc" },
            { id: "preview-delay", labelKey: "sec.preview-delay", descKey: "sec.preview-delay.desc" },
        ],
    },
    {
        id: "menubar",
        labelKey: "cat.menubar",
        icon: "menubar",
        sections: [
            { id: "masthead-left", labelKey: "sec.masthead-left", descKey: "sec.masthead-left.desc" },
            { id: "masthead-search", labelKey: "sec.masthead-search", descKey: "sec.masthead-search.desc" },
            { id: "masthead-right", labelKey: "sec.masthead-right", descKey: "sec.masthead-right.desc" },
            { id: "masthead-buttons", labelKey: "sec.masthead-buttons", descKey: "sec.masthead-buttons.desc" },
            { id: "masthead-styling", labelKey: "sec.masthead-styling", descKey: "sec.masthead-styling.desc" },
        ],
    },
    {
        id: "guide-sidebar",
        labelKey: "cat.guide-sidebar",
        icon: "guide-sidebar",
        sections: [
            { id: "guide-verhalten", labelKey: "sec.guide-verhalten", descKey: "sec.guide-verhalten.desc" },
            { id: "guide-ausgeklappt", labelKey: "sec.guide-ausgeklappt", descKey: "sec.guide-ausgeklappt.desc" },
            { id: "guide-eingeklappt", labelKey: "sec.guide-eingeklappt", descKey: "sec.guide-eingeklappt.desc" },
            { id: "guide-group-order", labelKey: "sec.guide-group-order", descKey: "sec.guide-group-order.desc" },
            { id: "guide-group-main", labelKey: "sec.guide-group-main", descKey: "sec.guide-group-main.desc" },
            {
                id: "guide-group-subscriptions",
                labelKey: "sec.guide-group-subscriptions",
                descKey: "sec.guide-group-subscriptions.desc",
            },
            {
                id: "guide-group-myYouTube",
                labelKey: "sec.guide-group-myYouTube",
                descKey: "sec.guide-group-myYouTube.desc",
            },
            {
                id: "guide-group-moreFromYT",
                labelKey: "sec.guide-group-moreFromYT",
                descKey: "sec.guide-group-moreFromYT.desc",
            },
            {
                id: "guide-group-discover",
                labelKey: "sec.guide-group-discover",
                descKey: "sec.guide-group-discover.desc",
            },
            { id: "guide-group-system", labelKey: "sec.guide-group-system", descKey: "sec.guide-group-system.desc" },
            { id: "guide-showmore", labelKey: "sec.guide-showmore", descKey: "sec.guide-showmore.desc" },
        ],
    },
    {
        id: "feed-chips",
        labelKey: "cat.feed-chips",
        icon: "feed-chips",
        sections: [
            { id: "chips-verhalten", labelKey: "sec.chips-verhalten", descKey: "sec.chips-verhalten.desc" },
            { id: "chips-watch", labelKey: "sec.chips-watch", descKey: "sec.chips-watch.desc" },
        ],
    },
    {
        id: "startpage",
        labelKey: "cat.startpage",
        icon: "startpage",
        sections: [{ id: "startpage-grid", labelKey: "sec.startpage-grid", descKey: "sec.startpage-grid.desc" }],
    },
    {
        id: "watch-page",
        labelKey: "cat.watch-page",
        icon: "watch-page",
        sections: [{ id: "watch-layout", labelKey: "sec.watch-layout", descKey: "sec.watch-layout.desc" }],
    },
    {
        id: "ads-promotions",
        labelKey: "cat.ads-promotions",
        icon: "ads-promotions",
        sections: [
            { id: "promo-hide", labelKey: "sec.promo-hide", descKey: "sec.promo-hide.desc" },
            { id: "shelves", labelKey: "sec.shelves", descKey: "sec.shelves.desc" },
            { id: "survey", labelKey: "sec.survey", descKey: "sec.survey.desc" },
        ],
    },
    {
        id: "system",
        labelKey: "cat.system",
        icon: "system",
        sections: [
            { id: "tweaks", labelKey: "sec.tweaks", descKey: "sec.tweaks.desc" },
            { id: "panel", labelKey: "sec.panel", descKey: "sec.panel.desc" },
            { id: "logging", labelKey: "sec.logging", descKey: "sec.logging.desc" },
            { id: "status", labelKey: "sec.status", descKey: "sec.status.desc" },
        ],
    },
    {
        id: "about",
        labelKey: "cat.about",
        icon: "about",
        sections: [{ id: "about", labelKey: "sec.about" }],
    },
];

/**
 * Looks up a category definition by id.
 *
 * @param id - The category id.
 * @returns The matching CategoryDef, or undefined if not found.
 */
export function getCategory(id: CategoryId): CategoryDef | undefined {
    return CATEGORIES.find((c) => c.id === id);
}

/**
 * Returns the first category id (the default active category on panel open).
 *
 * @returns The first category id.
 */
export function getDefaultCategoryId(): CategoryId {
    return CATEGORIES[0].id;
}
