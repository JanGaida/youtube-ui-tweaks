import log from "../log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: guide-groups — guide section group definitions + detection
// ─────────────────────────────────────────────────────────────────────────────
// * YouTube's guide sidebar is structured into sections (ytd-guide-section-renderer).
//   Some have titles ("Mehr von YouTube", "Entdecken"), others do not.
//   This file defines 6 logical groups and assigns each section to a group.
//
// * Detection: each group has a "signature entry" — a tracked entry key
//   that is unique to that group. A section belongs to the group when it
//   contains that entry (directly, in the collapsible header, or in sub-items).
//
// * Fixture structure (guide-full.fixture.html, 2026-08-22):
//   Section 0: Home + Shorts (direct)
//   Section 1: channel list + collapsible "Abos" (header=Subscriptions) + Mehr anzeigen
//   Section 2: collapsible "Mein YouTube" (header=/feed/you) + sub-entries
//   Section 3: title "Mehr von YouTube" → Premium + Music + Kids
//   Section 4: title "Entdecken" → Musik + Filme & Shows + Live + Mehr anzeigen
//   Section 5: report history (direct)

/** A guide group (logical section). */
export interface GuideGroupDef {
    /** Stable group id (e.g. "main", "moreFromYT"). */
    id: string;
    /** i18n key for the group label. */
    labelKey: string;
    /** Signature entry key: a tracked entry that is unique to this group. */
    signatureEntry: string;
    /** All entry keys belonging to this group (for UI rendering). */
    entryKeys: string[];
}

/** All 6 guide groups in default order. */
export const GUIDE_GROUPS: GuideGroupDef[] = [
    {
        id: "main",
        labelKey: "field.guideGroup.main",
        signatureEntry: "home",
        entryKeys: ["home", "shorts"],
    },
    {
        id: "subscriptions",
        labelKey: "field.guideGroup.subscriptions",
        signatureEntry: "subscriptions",
        entryKeys: ["subscriptions"],
    },
    {
        id: "myYouTube",
        labelKey: "field.guideGroup.myYouTube",
        signatureEntry: "myYouTube",
        entryKeys: [
            "myYouTube",
            "myChannel",
            "history",
            "playlists",
            "watchLater",
            "likedVideos",
            "myVideos",
            "downloads",
        ],
    },
    {
        id: "moreFromYT",
        labelKey: "field.guideGroup.moreFromYT",
        signatureEntry: "ytPremium",
        entryKeys: ["ytPremium", "ytMusic", "ytKids"],
    },
    {
        id: "discover",
        labelKey: "field.guideGroup.discover",
        signatureEntry: "music",
        entryKeys: ["music", "moviesShows", "live"],
    },
    {
        id: "system",
        labelKey: "field.guideGroup.system",
        signatureEntry: "reportHistory",
        entryKeys: ["reportHistory"],
    },
];

/** Default group order (for drag-and-drop + default settings). */
export const DEFAULT_GROUP_ORDER: string[] = GUIDE_GROUPS.map((g) => g.id);

/** Lookup: group id → definition. */
const GROUP_BY_ID = new Map(GUIDE_GROUPS.map((g) => [g.id, g]));

/** Lookup: entry key → group id. */
const ENTRY_TO_GROUP = new Map<string, string>();
for (const g of GUIDE_GROUPS) {
    for (const k of g.entryKeys) {
        ENTRY_TO_GROUP.set(k, g.id);
    }
}

/**
 * Returns the group id for an entry key.
 *
 * @param entryKey - The tracked entry key.
 * @returns The group id, or undefined if the entry is not assigned to a group.
 */
export function getGroupForEntry(entryKey: string): string | undefined {
    return ENTRY_TO_GROUP.get(entryKey);
}

/**
 * Returns the group definition for a group id.
 *
 * @param groupId - The group id.
 * @returns The definition, or undefined.
 */
export function getGroupDef(groupId: string): GuideGroupDef | undefined {
    return GROUP_BY_ID.get(groupId);
}

const SECTION_GROUP_ATTR = "data-yt-tweaks-guide-group";

/**
 * Detects the group id for a section based on the entries it contains.
 *
 * Collects all tracked entry keys in the section (direct + collapsible-section-header
 * + sub-entries) and matches them against the groups' signature entries.
 *
 * ! Order: specific groups (moreFromYT, discover, system) are checked before
 *   generic ones (main, subscriptions) to avoid false matches.
 *
 * @param section - The ytd-guide-section-renderer element.
 * @param detectEntryKeyFn - Entry key detection function (from guide-entries.ts).
 * @returns The group id, or null if no group matches.
 */
export function detectGroupForSection(
    section: HTMLElement,
    detectEntryKeyFn: (el: HTMLElement) => string | null,
): string | null {
    // * Collect all tracked entry keys in this section.
    const foundKeys = new Set<string>();
    for (const el of section.querySelectorAll<HTMLElement>("ytd-guide-entry-renderer")) {
        // * Exclude expand/collapse buttons (role=button, expander/collapser ids).
        if (el.getAttribute("role") === "button") continue;
        if (el.id === "expander-item" || el.id === "collapser-item") continue;
        const key = detectEntryKeyFn(el);
        if (key) foundKeys.add(key);
    }

    // * Match against signature entries (specific groups first).
    for (const g of GUIDE_GROUPS) {
        if (foundKeys.has(g.signatureEntry)) {
            section.setAttribute(SECTION_GROUP_ATTR, g.id);
            return g.id;
        }
    }
    return null;
}

/** Attribute marker for the section→group assignment (for restore + debug). */
export { SECTION_GROUP_ATTR };
