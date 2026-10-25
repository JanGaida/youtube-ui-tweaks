import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { GuideSettings } from "../settings";
import log from "../log";
import { detectGroupForSection, getGroupForEntry, SECTION_GROUP_ATTR } from "./guide-groups";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: guide-entries feature — hide + reorder YT guide entries (DOM)
// ─────────────────────────────────────────────────────────────────────────────
// * JS mutation: hides YT guide entries via display:none and reorders them via DOM moves
//   (appendChild/insertBefore). Analogous to masthead.ts (custom buttons), but applied to
//   YT's own guide entries. Idempotent via hash over hidden-map + order-array.
//
// * Selectors verified against __fixtures__/guide-full.fixture.html (captured 2026-08-22):
//   - Entry: ytd-guide-entry-renderer (29 matches in the fixture)
//   - Link:  a.yt-simple-endpoint (29 matches)
//   - Icon:  yt-icon.guide-icon + yt-img-shadow (channel avatars)
//   - Mini-guide: ytd-mini-guide-renderer (0 entries, disable-upgrade, hidden — out of scope)
//
// * Entry detection (3 strategies, since YT uses heterogeneous hrefs):
//   1. path match:    "/feed/history" -> history (YT standard paths)
//   2. hostname match: studio.youtube.com -> myVideos, music.youtube.com -> ytMusic, etc.
//   3. title match:  title="Shorts" (Shorts has NO href in the fixture!)
//   4. parent-section: myChannel — entry under the /feed/you collapsible-section without a known feed-href
//
// * Expand/collapse buttons (id="expander-item", id="collapser-item", role="button") are
//   excluded — they are not nav entries.

const ENTRY_SEL = "ytd-guide-entry-renderer";
const SECTION_SEL = "ytd-guide-section-renderer";
const HIDE_ATTR = "data-yt-tweaks-guide-hidden";
// * Marker for hidden sections (all entries hidden → the whole section incl. title removed).
const SECTION_HIDE_ATTR = "data-yt-tweaks-guide-section-hidden";

// * Entries that are not nav entries (expand/collapse buttons).
const EXCLUDE_IDS = new Set(["expander-item", "collapser-item"]);

/**
 * Known guide entry keys with their path patterns (YT standard paths).
 *
 * Verified against guide-full.fixture.html (captured 2026-08-22).
 * Keys without a path match (shorts, myVideos, myChannel, ytMusic, ytKids) are
 * detected separately via title/hostname/parent-section (see detectEntryKey).
 */
const GUIDE_ENTRY_PATHS: Record<string, string> = {
    home: "/",
    subscriptions: "/feed/subscriptions",
    myYouTube: "/feed/you",
    history: "/feed/history",
    playlists: "/feed/playlists",
    watchLater: "/playlist?list=WL",
    likedVideos: "/playlist?list=LL",
    downloads: "/feed/downloads",
    ytPremium: "/premium",
    music: "/channel/UC-9-kyTW8ZkZkZNDHQJ6FgpwQ",
    moviesShows: "/feed/storefront",
    live: "/channel/UC4R8DWoMoI7CAwX8_LjQHig",
    reportHistory: "/reporthistory",
};

/**
 * External hostnames -> entry key (for entries with external URLs).
 *
 * myVideos -> studio.youtube.com (YouTube Studio, external)
 * ytMusic  -> music.youtube.com (YouTube Music, external)
 * ytKids   -> www.youtubekids.com (YouTube Kids, external)
 */
const GUIDE_ENTRY_HOSTNAMES: Record<string, string> = {
    "studio.youtube.com": "myVideos",
    "music.youtube.com": "ytMusic",
    "www.youtubekids.com": "ytKids",
};

/**
 * title attribute -> entry key (for entries without href, or as a fallback on path miss).
 *
 * ! Shorts has NO href in the fixture — only title="Shorts".
 * ~ Discover entries (Musik/Filme & Shows/Live) have channel-ID hrefs that can change
 *   → title match as a robust fallback. YT-localized titles (de): "Musik", "Filme & Shows", "Live".
 *   ! title is YT-localized — only reliable for the de locale. Other locales via path match (primary).
 */
const GUIDE_ENTRY_TITLES: Record<string, string> = {
    Shorts: "shorts",
    Musik: "music",
    "Filme & Shows": "moviesShows",
    "Films & Shows": "moviesShows",
    Live: "live",
};

/** All known entry keys (for GUI rendering, drag-and-drop). */
export const GUIDE_ENTRY_KEYS: string[] = [
    "home",
    "shorts",
    "subscriptions",
    "myYouTube",
    "myChannel",
    "history",
    "playlists",
    "watchLater",
    "likedVideos",
    "myVideos",
    "downloads",
    "ytPremium",
    "ytMusic",
    "ytKids",
    "music",
    "moviesShows",
    "live",
    "reportHistory",
];

/**
 * Detects the entry key from href, title, and parent section.
 *
 * Strategies (in order):
 * 1. hostname match (external URLs: studio/music/kids)
 * 2. path match (YT standard paths: /feed/history etc.)
 * 3. title match (Shorts — no href)
 * 4. parent-section match (myChannel — /@user under the /feed/you section)
 *
 * @param el - The ytd-guide-entry-renderer element.
 * @returns The entry key, or null if no match.
 */
function detectEntryKey(el: HTMLElement): string | null {
    const link = el.querySelector<HTMLAnchorElement>("a.yt-simple-endpoint, a[href]");

    // * 1. hostname match (external URLs).
    if (link?.href) {
        try {
            const url = new URL(link.href, "https://www.youtube.com");
            const hostname = url.hostname;
            if (GUIDE_ENTRY_HOSTNAMES[hostname]) {
                return GUIDE_ENTRY_HOSTNAMES[hostname];
            }
            // * 2. path match (YT-internal paths).
            const path = url.pathname + url.search;
            for (const [key, pattern] of Object.entries(GUIDE_ENTRY_PATHS)) {
                if (path === pattern || (pattern !== "/" && path.startsWith(pattern))) {
                    // * Special case: "/" (home) — exact match only, not startsWith.
                    if (pattern === "/" && path !== "/") continue;
                    return key;
                }
            }
        } catch {
            // * Invalid href — ignore.
        }
    }

    // * 3. title match (Shorts has no href, only the title attribute).
    const title = link?.getAttribute("title") ?? el.getAttribute("title");
    if (title && GUIDE_ENTRY_TITLES[title]) {
        return GUIDE_ENTRY_TITLES[title];
    }

    // * 4. parent-section match (myChannel).
    // * myChannel is the entry under the /feed/you collapsible-section that has no
    //   known feed-href (it is a /@user href, user-specific).
    const parentSection = el.closest("ytd-guide-collapsible-section-entry-renderer");
    if (parentSection) {
        const headerLink = parentSection.querySelector<HTMLAnchorElement>("#header-entry a.yt-simple-endpoint");
        if (headerLink) {
            try {
                const headerUrl = new URL(headerLink.href, "https://www.youtube.com");
                if (headerUrl.pathname === "/feed/you") {
                    // * This entry sits under "Mein YouTube" — if it has no known
                    //   feed-href (not history/playlists/watchLater/etc.), it is myChannel.
                    // * (The known feed-hrefs were already detected above via path match
                    //   and returned — if we get here, it is not a known feed-href.)
                    if (link?.href) {
                        try {
                            const url = new URL(link.href, "https://www.youtube.com");
                            if (url.pathname.startsWith("/@")) return "myChannel";
                        } catch {
                            // * Ignore.
                        }
                    }
                }
            } catch {
                // * Ignore.
            }
        }
    }

    return null;
}

/**
 * Checks whether an entry should be excluded (expand/collapse buttons).
 *
 * @param el - The ytd-guide-entry-renderer element.
 * @returns True if the entry should be excluded.
 */
function isExcludedEntry(el: HTMLElement): boolean {
    const id = el.id;
    if (id && EXCLUDE_IDS.has(id)) return true;
    // * role="button" entries are expand/collapse (not nav entries).
    if (el.getAttribute("role") === "button") return true;
    // * is-header entries (collapsible-section headers like "Abos", "Mein YouTube")
    //   are nav entries themselves (they have hrefs) — do NOT exclude.
    return false;
}

/**
 * Collects all guide entry elements with their detected key.
 *
 * Searches the full guide (the mini-guide has 0 entries on desktop — out of scope).
 * Excludes expand/collapse buttons.
 *
 * @returns Array of { key, el } — only entries with a detected key.
 */
function collectEntries(): { key: string; el: HTMLElement }[] {
    const result: { key: string; el: HTMLElement }[] = [];
    const els = document.querySelectorAll<HTMLElement>(ENTRY_SEL);
    for (const el of Array.from(els)) {
        if (isExcludedEntry(el)) continue;
        const key = detectEntryKey(el);
        if (key) result.push({ key, el });
    }
    return result;
}

/**
 * Finds the reorder container (direct parent of the "movable unit") for an entry.
 *
 * The movable unit is either the entry itself (flat section) or its enclosing
 * wrapper renderer (e.g. ytd-guide-downloads-entry-renderer). The container is the parent
 * of that unit — for downloads that is #section-items (the wrapper's parent), not the
 * wrapper itself. That way downloads get sorted together with the flat siblings.
 *
 * ~ Heuristic: climb up from the entry to the direct child of an #items/#section-items/#expanded
 *   container. The first ancestor whose parent is one of the known guide item containers
 *   marks the unit; its parent is the reorder container.
 *
 * @param entryEl - The ytd-guide-entry-renderer element.
 * @returns The container (parent of the movable unit), or null.
 */
function findReorderContainer(entryEl: HTMLElement): HTMLElement | null {
    const REORDER_CONTAINER_IDS = new Set(["items", "section-items", "expanded"]);
    let node: HTMLElement | null = entryEl;
    while (node !== null) {
        const parent: HTMLElement | null = node.parentElement;
        if (parent === null) break;
        if (parent.id && REORDER_CONTAINER_IDS.has(parent.id)) {
            return parent;
        }
        node = parent;
    }
    return entryEl.parentElement;
}

let lastEntriesHash = "";
const hiddenEls: Set<HTMLElement> = new Set();
// * Hidden sections (group hidden OR all entries hidden → section incl. title removed).
const hiddenSections: Set<HTMLElement> = new Set();
// * "Mehr anzeigen" expanders expanded via showMore (marker attribute, restore removes it).
const expandedExpanders: Set<HTMLElement> = new Set();

/**
 * True when the tracked hidden elements are still connected to the document.
 *
 * * Polymer re-renders guide nodes on SPA navigation: the previously-hidden elements become
 *   DETACHED (isConnected false) while fresh, unhidden replacements exist. A settings-only
 *   hash cannot detect that — this check can. Tracked-but-empty is "live" (nothing to lose).
 */
function appliedStateIsLive(): boolean {
    for (const el of hiddenEls) {
        if (!el.isConnected) return false;
    }
    for (const sec of hiddenSections) {
        if (!sec.isConnected) return false;
    }
    return true;
}

/**
 * Run: hides + reorders guide entries + manages groups + "Mehr anzeigen" via DOM mutation.
 *
 * Idempotent via hash over hidden-maps + order-arrays + showMore — plus a DOM-liveness check:
 * the hash contains NO DOM component, but Polymer re-renders fresh nodes on SPA nav
 * (tracked elements become detached, fresh entries are unhidden/unsorted). The
 * liveness check (appliedStateIsLive) invalidates the early return in that case → re-apply.
 *
 * @param ctx - The page context.
 */
function guideEntriesRun(ctx: PageCtx): void {
    const g = ctx.settings.guide;
    if (!g.enabled) {
        guideEntriesRestore();
        return;
    }
    const entries = collectEntries();
    if (entries.length === 0) return;

    // * Hash over hidden-maps + order-arrays + showMore → idempotency.
    const hiddenKeys = Object.keys(g.entries.hidden)
        .filter((k) => g.entries.hidden[k])
        .sort();
    const groupHiddenKeys = Object.keys(g.entries.groups.hidden)
        .filter((k) => g.entries.groups.hidden[k])
        .sort();
    const hash = `${hiddenKeys.join(",")}|${g.entries.order.join(",")}|${groupHiddenKeys.join(",")}|${g.entries.groups.order.join(",")}|${g.showMoreButton}|${g.showMoreDefault}`;
    // * Settings unchanged AND tracked DOM still live → nothing to do. Settings-only hashes
    //   cannot detect SPA re-renders — the liveness check can (detached tracked elements).
    if (hash === lastEntriesHash && appliedStateIsLive()) return;
    lastEntriesHash = hash;

    // * Restore previously hidden entries (if any).
    for (const el of hiddenEls) {
        el.style.display = "";
        el.removeAttribute(HIDE_ATTR);
    }
    hiddenEls.clear();
    // * Restore previously hidden sections.
    for (const sec of hiddenSections) {
        sec.style.display = "";
        sec.removeAttribute(SECTION_HIDE_ATTR);
    }
    hiddenSections.clear();
    // * Restore previous showMore expanders (remove marker — the click state is transient).
    for (const exp of expandedExpanders) {
        exp.removeAttribute("data-yt-tweaks-guide-expanded");
    }
    expandedExpanders.clear();

    // * 1. Group assignment + group hide: section with a detected group + group.hidden=true
    //   → whole section display:none (incl. title, channels, everything).
    for (const section of document.querySelectorAll<HTMLElement>(SECTION_SEL)) {
        const groupId = detectGroupForSection(section, detectEntryKey);
        if (groupId && g.entries.groups.hidden[groupId]) {
            section.style.display = "none";
            section.setAttribute(SECTION_HIDE_ATTR, "");
            hiddenSections.add(section);
        }
    }

    // * 2. Hide entries (per-entry, only when the group is not already hidden).
    for (const { key, el } of entries) {
        if (g.entries.hidden[key]) {
            el.style.display = "none";
            el.setAttribute(HIDE_ATTR, "");
            hiddenEls.add(el);
        }
    }

    // * 3. Hide empty sections: when ALL direct entries in a section are display:none
    //   (group not hidden, but all per-entry hidden → section empty → hide).
    //   ! Checks only direct entries in #items. ~ jsdom quirk: `#items` fails → `[id="items"]`.
    for (const section of document.querySelectorAll<HTMLElement>(SECTION_SEL)) {
        if (hiddenSections.has(section)) continue; // * skip already group-hidden.
        const items = section.querySelector<HTMLElement>('[id="items"]');
        if (!items) continue;
        let hasEntries = false;
        let allHidden = true;
        for (const child of items.children) {
            if (child.tagName.toLowerCase() !== ENTRY_SEL) continue;
            hasEntries = true;
            if ((child as HTMLElement).style.display !== "none") allHidden = false;
        }
        if (hasEntries && allHidden) {
            section.style.display = "none";
            section.setAttribute(SECTION_HIDE_ATTR, "");
            hiddenSections.add(section);
        }
    }

    // * 4. "Mehr anzeigen" expander (global, not per-group).
    //   showMoreDefault=true → expand all "Mehr anzeigen" expanders (simulate a click).
    //   showMoreButton=false → hide all expander buttons (display:none).
    //   ! Both flags are INDEPENDENT: showMoreDefault controls the expanded state,
    //     showMoreButton the button's visibility. Both active → expanded + button hidden.
    //   ~ The expander is ytd-guide-collapsible-entry-renderer with title="Mehr anzeigen"
    //     (or "Weniger anzeigen" if already expanded).
    //   ~ Order: expand first (click → title becomes "Weniger anzeigen"),
    //     then hide — the hide loop checks both titles.
    //   ! The expander titles are YT-localized — only de/en reliable (see the locale switch below).
    const [moreTitle, lessTitle] =
        ctx.locale === "de" ? ["Mehr anzeigen", "Weniger anzeigen"] : ["Show more", "Show less"];
    if (g.showMoreDefault) {
        // * Expand all "Mehr anzeigen" expanders.
        for (const exp of document.querySelectorAll<HTMLElement>(
            `ytd-guide-collapsible-entry-renderer a[title="${moreTitle}"]`,
        )) {
            exp.setAttribute("data-yt-tweaks-guide-expanded", "");
            exp.click();
            expandedExpanders.add(exp);
        }
    }
    if (!g.showMoreButton) {
        // * Hide all expanders (both "Mehr anzeigen" and "Weniger anzeigen").
        for (const exp of document.querySelectorAll<HTMLElement>("ytd-guide-collapsible-entry-renderer")) {
            const a = exp.querySelector<HTMLElement>("a");
            if (!a) continue;
            const title = a.getAttribute("title");
            if (title === moreTitle || title === lessTitle) {
                exp.style.display = "none";
                exp.setAttribute("data-yt-tweaks-guide-more-hidden", "");
                hiddenEls.add(exp);
            }
        }
    }

    // * 5. Reorder groups (sections) — DOM moves within #sections.
    //   Collect sections with a detected group, sort by groups.order, re-append.
    //   Sections without a detected group keep their position (untracked at the end).
    const sectionsContainer = document.querySelector<HTMLElement>('[id="guide-renderer"] [id="sections"]');
    if (sectionsContainer) {
        const sectionEls = Array.from(sectionsContainer.children).filter(
            (c) => c.tagName.toLowerCase() === SECTION_SEL,
        ) as HTMLElement[];
        const sectionByGroup = new Map<string, HTMLElement>();
        for (const sec of sectionEls) {
            const gid = sec.getAttribute(SECTION_GROUP_ATTR);
            if (gid) sectionByGroup.set(gid, sec);
        }
        const orderedSections: HTMLElement[] = [];
        const remainingSections = [...sectionEls];
        for (const orderGid of g.entries.groups.order) {
            const idx = remainingSections.findIndex((s) => s.getAttribute(SECTION_GROUP_ATTR) === orderGid);
            if (idx !== -1) {
                orderedSections.push(remainingSections.splice(idx, 1)[0]);
            }
        }
        orderedSections.push(...remainingSections);
        for (const sec of orderedSections) {
            sectionsContainer.appendChild(sec);
        }
    }

    // * 6. Reorder entries (DOM moves within their respective containers).
    //   ! Bug 2: previously this grouped per entry.el.parentElement + appendChild. With
    //     a nested structure that breaks:
    //     - Downloads sits inside the ytd-guide-downloads-entry-renderer wrapper (parent = wrapper),
    //       siblings directly in #section-items → different parents → never sorted together.
    //     - appendChild to the end puts tracked entries BEHIND untracked siblings
    //       (e.g. ytd-guide-collapsible-entry-renderer "Mehr anzeigen" in Discover) → shifts forward.
    //   Solution: treat the direct children of each container as "movable units" (the entry
    //   itself or its enclosing wrapper). Tracked units are sorted by order,
    //   non-tracked (expander wrappers) keep their relative position (stable sort).
    //   Rank: tracked → order.indexOf(key); non-tracked/unknown → MAX (at the end, stable).
    const byContainer = new Map<HTMLElement, { key: string | null; unit: HTMLElement }[]>();
    for (const entry of entries) {
        const container = findReorderContainer(entry.el);
        if (!container) continue;
        const list = byContainer.get(container) ?? [];
        list.push({ key: entry.key, unit: entry.el });
        byContainer.set(container, list);
    }
    for (const [container, trackedUnits] of byContainer) {
        // * Build the unit list from ALL direct children: tracked (with key) or
        //   non-tracked (key=null). For wrapper entries (downloads) the direct child
        //   is the wrapper — its key is determined via the contained tracked entry.
        const trackedUnitEls = new Set(trackedUnits.map((u) => u.unit));
        const keyByUnit = new Map<HTMLElement, string | null>();
        for (const { key, unit } of trackedUnits) keyByUnit.set(unit, key);
        const units: { key: string | null; unit: HTMLElement; origIdx: number }[] = [];
        let i = 0;
        for (const child of Array.from(container.children)) {
            const el = child as HTMLElement;
            if (trackedUnitEls.has(el)) {
                units.push({ key: keyByUnit.get(el) ?? null, unit: el, origIdx: i++ });
            } else {
                // * Non-tracked direct child — possibly a wrapper containing a tracked entry
                //   (e.g. ytd-guide-downloads-entry-renderer). Otherwise non-tracked (expander wrapper).
                let key: string | null = null;
                const inner = el.querySelector<HTMLElement>("ytd-guide-entry-renderer");
                if (inner) key = detectEntryKey(inner);
                units.push({ key, unit: el, origIdx: i++ });
            }
        }
        // * Stable sort: tracked-in-order by rank, the rest by origIdx (position preserved).
        const orderArr = g.entries.order;
        const rank = (key: string | null): number => {
            if (key === null) return Number.MAX_SAFE_INTEGER;
            const idx = orderArr.indexOf(key);
            return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
        };
        units.sort((a, b) => {
            const ra = rank(a.key);
            const rb = rank(b.key);
            if (ra !== rb) return ra - rb;
            return a.origIdx - b.origIdx;
        });
        // * Reorder via appendChild in sorted order (appending a child MOVES it — the
        //   untracked siblings keep their relative order and end up after the tracked ones).
        for (const { unit } of units) {
            container.appendChild(unit);
        }
    }

    log.debug(
        "guide-entries",
        `applied: ${hiddenEls.size} entries hidden, ${hiddenSections.size} sections hidden, ${entries.length} entries + groups reordered`,
    );
}

/**
 * Restore: show hidden entries + sections again. The reorder is not reverted
 * (Polymer renders fresh nodes on SPA nav → original order automatically).
 */
function guideEntriesRestore(): void {
    for (const el of hiddenEls) {
        el.style.display = "";
        el.removeAttribute(HIDE_ATTR);
        el.removeAttribute("data-yt-tweaks-guide-more-hidden");
    }
    hiddenEls.clear();
    for (const sec of hiddenSections) {
        sec.style.display = "";
        sec.removeAttribute(SECTION_HIDE_ATTR);
    }
    hiddenSections.clear();
    for (const exp of expandedExpanders) {
        exp.removeAttribute("data-yt-tweaks-guide-expanded");
    }
    expandedExpanders.clear();
    lastEntriesHash = "";
}

/**
 * Guide-entries feature: hide + reorder YT guide entries (DOM mutation).
 *
 * * DOM fixture: __fixtures__/guide-full.fixture.html (captured 2026-08-22 — 29 entries, 6 sections;
 *   selectors verified: ytd-guide-entry-renderer, a.yt-simple-endpoint, yt-icon.guide-icon).
 *   Mini-guide (__fixtures__/guide-mini.fixture.html): 0 entries, disable-upgrade, hidden — out of scope.
 * ~ DECISION-LOG: DOM moves (not CSS order) for reordering — analogous to the masthead.ts idempotency hash.
 *   Entry detection via 4 strategies (path/hostname/title/parent-section) because YT uses
 *   heterogeneous hrefs (Shorts has no href, myVideos is external, myChannel is user-specific).
 */
export const guideEntriesFeature: Feature = {
    id: "guide-entries",
    settingsPath: "guide.entries",
    pages: {
        "*": { run: guideEntriesRun, restore: guideEntriesRestore },
    },
    liveApplyKeys: [
        "guide.entries.hidden",
        "guide.entries.order",
        "guide.entries.groups.hidden",
        "guide.entries.groups.order",
        "guide.showMoreButton",
        "guide.showMoreDefault",
        "guide.enabled",
    ],
};
