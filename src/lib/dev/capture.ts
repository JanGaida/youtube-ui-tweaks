/**
 * Fixture capture tooling (dev-only, gated by `__DEV_CAPTURE__`).
 *
 * Captures real YouTube DOM snippets plus computed styles and shadow-boundary markers into a
 * self-contained `.fixture.html` file, auto-downloaded for placement in
 * `src/lib/core/__fixtures__/`. The resulting fixtures are consumed by jsdom-based vitest tests
 * to detect selector regressions and validate feature transforms against real YT structure.
 *
 * ! This module is only imported when `__DEV_CAPTURE__` is true. In production builds the import
 *   sites are guarded by `if (__DEV_CAPTURE__)` and the code is dead-code-eliminated.
 */

import { mount, unmount, type Component } from "svelte";
import CaptureProgress from "./CaptureProgress.svelte";

/** A selector target within a fixture type — the root to capture and the selectors to probe. */
export interface CaptureTarget {
    /** CSS selector for the root element(s) to capture as outerHTML. */
    root: string;
    /** Optional selectors whose match-count is recorded in the fixture header. */
    probes?: string[];
}

/** Definition of a fixture type preset (registered as a Tampermonkey menu entry). */
export interface FixtureTypePreset {
    /** Stable id used as the default filename stem. */
    id: string;
    /** Human-readable label for the GM-Menu entry. */
    label: string;
    /**
     * Optional YouTube page URL to navigate to before capturing. When set, the GM-Menu entry
     * navigates here first, waits for the page to load, then captures. When absent the current
     * page is captured as-is (the user must navigate manually first).
     */
    navUrl?: string;
    /** Selector targets to capture within this fixture. */
    targets: CaptureTarget[];
}

/** Common grid-item probes — identical selectors across all grid-bearing pages, but the
 *  captured DOM proves whether they match per-page (channel/search may differ structurally). */
const GRID_ITEM_PROBES = [
    ".ytLockupMetadataViewModelStandard",
    ".ytContentMetadataViewModelMetadataText",
    ".ytLockupMetadataViewModelAvatar",
    ".ytLockupMetadataViewModelMenuButton",
    ".ytContentMetadataViewModelMetadataRowMetadataRowWrap",
];

/** Fixture-type presets — page-based grid-item fixtures + element-specific ad/masthead fixtures.
 *
 * ! Each grid-page preset is a SEPARATE fixture because the grid-item DOM structure may differ
 *   per page (channel uses different layout than home, search yet another). The fixture proves
 *   whether the shared selectors actually match on that page. */
export const FIXTURE_PRESETS: FixtureTypePreset[] = [
    {
        id: "home-grid-item",
        label: "Home — Grid Item",
        navUrl: "https://www.youtube.com/",
        targets: [{ root: "ytd-rich-item-renderer", probes: GRID_ITEM_PROBES }],
    },
    {
        id: "subscriptions-grid-item",
        label: "Subscriptions — Grid Item",
        navUrl: "https://www.youtube.com/feed/subscriptions",
        targets: [{ root: "ytd-rich-item-renderer", probes: GRID_ITEM_PROBES }],
    },
    {
        id: "channel-grid-item",
        label: "Channel — Grid Item",
        navUrl: "https://www.youtube.com/@YouTube",
        targets: [
            {
                root: "ytd-rich-item-renderer, ytd-grid-video-renderer",
                probes: GRID_ITEM_PROBES,
            },
        ],
    },
    {
        id: "search-grid-item",
        label: "Search — Grid Item",
        navUrl: "https://www.youtube.com/results?search_query=test",
        targets: [
            {
                root: "ytd-video-renderer, ytd-rich-item-renderer",
                probes: GRID_ITEM_PROBES,
            },
        ],
    },
    {
        id: "masthead",
        label: "Masthead (Topbar) — any page",
        targets: [
            {
                root: "ytd-masthead",
                probes: ["ytd-masthead #container", "ytd-masthead #start", "ytd-masthead #center", "ytd-masthead #end"],
            },
        ],
    },
    {
        id: "guide-full",
        label: "Guide (Full Sidebar) — Home",
        navUrl: "https://www.youtube.com/",
        targets: [
            {
                root: "#guide, ytd-guide-renderer",
                probes: [
                    "ytd-guide-entry-renderer",
                    "ytd-guide-entry-renderer a.yt-simple-endpoint",
                    "ytd-guide-section-renderer",
                ],
            },
        ],
    },
    {
        id: "guide-mini",
        label: "Guide (Mini Sidebar) — Home",
        navUrl: "https://www.youtube.com/",
        targets: [
            {
                root: "ytd-mini-guide-renderer",
                probes: ["ytd-mini-guide-entry-renderer", "ytd-mini-guide-entry-renderer a.yt-simple-endpoint"],
            },
        ],
    },
    {
        id: "member-only-badge",
        label: "Member-Only Badge — Home/Subscriptions",
        navUrl: "https://www.youtube.com/feed/subscriptions",
        targets: [
            {
                root: "ytd-rich-item-renderer",
                // * Live lockup structure: member-only badge = badge-shape.ytBadgeShapeCommerce
                // * (old badge-style-type-members-only is dead — probe-count 0 since 2026-08-23).
                probes: ["badge-shape.ytBadgeShapeCommerce", ".ytLockupViewModelMetadata badge-shape"],
            },
        ],
    },
];

/** Metadata embedded in the fixture header (machine-readable via `<fixture-meta>`). */
export interface FixtureMeta {
    /** ISO date the fixture was captured. */
    captured: string;
    /** URL at capture time. */
    url: string;
    /** Content locale at capture time. */
    locale: string;
    /** Fixture-type preset id. */
    type: string;
    /** Selector targets captured. */
    targets: CaptureTarget[];
    /** Selector → match-count map (light DOM only; shadow-boundary selectors marked). */
    probeCounts: Record<string, { count: number; shadowBoundary: boolean }>;
}

/**
 * Walks an element and records which descendants cross a shadow-DOM boundary.
 *
 * @param root - The root element to walk.
 * @returns A set of selectors known to end in shadow DOM within this root (best-effort).
 */
function detectShadowBoundaries(root: Element): Set<string> {
    const shadow = new Set<string>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
        if (node instanceof Element && node.shadowRoot) {
            shadow.add(node.tagName.toLowerCase());
        }
        node = walker.nextNode();
    }
    return shadow;
}

/**
 * Extracts the computed styles of an element, filtered to properties carrying `!important` or
 * layout-critical values (display, font-size, width, height, text-align, etc.).
 *
 * @param el - The element to inspect.
 * @returns A compact CSS-text block of relevant computed declarations.
 */
function extractComputedStyles(el: Element): string {
    const cs = getComputedStyle(el);
    const props = [
        "display",
        "font-size",
        "line-height",
        "text-align",
        "width",
        "height",
        "min-width",
        "padding-top",
        "margin-left",
        "margin-right",
        "color",
        "fill",
        "visibility",
    ];
    const lines: string[] = [];
    const tag = el.tagName.toLowerCase();
    for (const p of props) {
        const val = cs.getPropertyValue(p);
        if (val) lines.push(`/* ${tag} { ${p}: ${val} } */`);
    }
    return lines.join("\n");
}

/**
 * Builds the self-contained fixture HTML blob: header comment + `<fixture-meta>` + computed
 * styles + captured DOM.
 *
 * @param meta    - The capture metadata.
 * @param domHtml - The captured outerHTML of all target roots.
 * @param styles  - The extracted computed-style text.
 * @returns The full `.fixture.html` content.
 */
function buildFixtureBlob(meta: FixtureMeta, domHtml: string, styles: string): string {
    const header = [
        `<!-- FIXTURE: ${meta.type} | captured: ${meta.captured} | url: ${meta.url} | locale: ${meta.locale}`,
        `     | capture-tool: dev/capture.ts`,
        `     | probe-counts: ${JSON.stringify(meta.probeCounts)}`,
        `     | recapture: run build:dev → TM menu "Capture All Fixtures" → paste over this file`,
        `-->`,
    ].join("\n");
    const metaTag = `<fixture-meta data-captured="${meta.captured}" data-locale="${meta.locale}" data-url="${meta.url}" data-type="${meta.type}" data-probe-counts='${JSON.stringify(meta.probeCounts)}'></fixture-meta>`;
    const styleBlock = styles ? `<style id="fixture-computed" data-yt-tweaks-fixture>\n${styles}\n</style>` : "";
    return `${header}\n${metaTag}\n${styleBlock}\n<!-- captured DOM -->\n${domHtml}\n`;
}

/**
 * Triggers an auto-download of the fixture blob as a `.fixture.html` file.
 *
 * @param filename - The download filename.
 * @param content  - The fixture HTML content.
 */
function downloadFixture(filename: string, content: string): void {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Captures a fixture of the given preset type from the current live YouTube page.
 *
 * Walks each target's root selector, captures outerHTML + computed styles, records probe
 * match-counts and shadow-boundary markers, then auto-downloads the result.
 *
 * @param preset - The fixture-type preset to capture.
 * @returns The fixture filename that was downloaded, or null if no roots matched.
 */
export function captureFixture(preset: FixtureTypePreset): string | null {
    const now = new Date().toISOString().slice(0, 10);
    const url = location.href;
    const locale = document.documentElement.lang || "unknown";

    const domParts: string[] = [];
    const styleParts: string[] = [];
    const probeCounts: Record<string, { count: number; shadowBoundary: boolean }> = {};

    for (const target of preset.targets) {
        const roots = document.querySelectorAll<HTMLElement>(target.root);
        if (roots.length === 0) continue;
        const shadowTags = detectShadowBoundaries(roots[0]);
        for (const el of Array.from(roots)) {
            domParts.push(el.outerHTML);
            styleParts.push(extractComputedStyles(el));
        }
        for (const probe of target.probes ?? []) {
            const count = document.querySelectorAll(probe).length;
            // * Heuristic: if the probe selector targets a custom element known to shadow-root,
            //   mark it as a shadow boundary (jsdom cannot reach inside).
            const shadowBoundary = Array.from(shadowTags).some((tag) => probe.includes(tag));
            probeCounts[probe] = { count, shadowBoundary };
        }
    }

    if (domParts.length === 0) {
        console.warn(`[capture] no roots matched for preset "${preset.id}"`);
        return null;
    }

    const meta: FixtureMeta = {
        captured: now,
        url,
        locale,
        type: preset.id,
        targets: preset.targets,
        probeCounts,
    };

    const blob = buildFixtureBlob(meta, domParts.join("\n"), styleParts.join("\n"));
    const filename = `${preset.id}.fixture.html`;
    downloadFixture(filename, blob);
    console.info(`[capture] downloaded ${filename} (${blob.length} chars)`, meta);
    return filename;
}

/**
 * Looks up a fixture-type preset by id.
 *
 * @param id - The preset id.
 * @returns The preset, or undefined if not found.
 */
export function getPreset(id: string): FixtureTypePreset | undefined {
    return FIXTURE_PRESETS.find((p) => p.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Capture All — SPA-navigation batch (no reload, JS context survives)
// ─────────────────────────────────────────────────────────────────────────────
// * YouTube is a SPA. Navigating via `location.href` triggers a full reload → the running JS
//   context dies → a single in-memory loop can't span pages. Instead, `captureAllSequential`
//   navigates using YouTube's OWN client-side router by clicking real anchor links found in
//   the sidebar/guide. SPA navigation keeps the JS context alive and fires `yt-navigate-finish`
//   when the new page's content is ready — the loop awaits that event before capturing.
//
// * Flow per preset:
//   1. If the preset's navUrl matches the current page → capture immediately.
//   2. Else find an <a href="navUrl"> in the guide/sidebar and .click() it (SPA nav).
//   3. Await `yt-navigate-finish` (or a timeout fallback) + a short render delay.
//   4. captureFixture(preset) → auto-download.
// * Presets without a navUrl (masthead) capture the current page without navigation.
//
// ! Runs in the real YouTube page via Tampermonkey (dev build). YouTube's bot detection blocks
//   Playwright-driven capture, so this is the only reliable batch-capture path.

/** Returns a promise resolving on the next `yt-navigate-finish` event, with a timeout fallback. */
function waitForNavigateFinish(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        let done = false;
        const finish = (): void => {
            if (done) return;
            done = true;
            window.removeEventListener("yt-navigate-finish", finish);
            clearTimeout(timer);
            // * Short delay so grid items render after the nav event fires.
            setTimeout(resolve, 1000);
        };
        window.addEventListener("yt-navigate-finish", finish, { once: true });
        const timer = setTimeout(() => {
            console.warn(`[capture-all] yt-navigate-finish timeout after ${timeoutMs}ms — capturing anyway`);
            finish();
        }, timeoutMs);
    });
}

/**
 * Triggers YouTube SPA navigation to the given URL by clicking a matching anchor link.
 *
 * Finds an `<a href="…">` whose pathname+search match the target URL, in the guide/sidebar or
 * anywhere in the document. A real click fires YouTube's client-side router → SPA nav (no
 * reload) → `yt-navigate-finish`.
 *
 * @param targetUrl - The absolute YouTube URL to navigate to.
 * @returns True if a matching anchor was found and clicked.
 */
function spaNavigate(targetUrl: string): boolean {
    let target: URL;
    try {
        target = new URL(targetUrl, "https://www.youtube.com");
    } catch {
        return false;
    }
    // * Search the guide/sidebar first (the most reliable nav source), then the whole document.
    const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("#guide a, ytd-guide-renderer a, #contentContainer a, a"),
    );
    const match = links.find((a) => {
        try {
            const href = new URL(a.href, "https://www.youtube.com");
            return href.pathname === target.pathname && href.search === target.search;
        } catch {
            return false;
        }
    });
    if (!match) {
        console.warn(`[capture-all] no anchor link found for ${targetUrl}`);
        return false;
    }
    console.info(`[capture-all] clicking SPA link → ${targetUrl}`);
    match.click();
    return true;
}

/**
 * Compares two YouTube URLs for "same page" (pathname + search match).
 *
 * @param a - First URL.
 * @param b - Second URL.
 * @returns True if both URLs point to the same YouTube SPA page.
 */
function samePage(a: string, b: string): boolean {
    try {
        const ua = new URL(a, "https://www.youtube.com");
        const ub = new URL(b, "https://www.youtube.com");
        return ua.pathname === ub.pathname && ua.search === ub.search;
    } catch {
        return a === b;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: CaptureOverlay — Svelte-backed progress UI for the capture-all batch
// ─────────────────────────────────────────────────────────────────────────────
// * Mounts CaptureProgress.svelte in document.body (survives YouTube SPA nav — body is not
//   wiped by SPA route changes). Drives reactivity by mutating the bound statuses array + done
//   flag; Svelte 5's $bindable props pick up the mutations and re-render live.

/**
 * Manages the CaptureProgress overlay lifecycle + live status updates.
 *
 * Mount/unmount pattern mirrors main.ts openSettings/closeSettings. The component owns its
 * reactive state internally; CaptureOverlay calls the component's exported imperative methods
 * (update/done) to drive live re-renders. done() shows instructions + close button; close()
 * unmounts the component.
 */
class CaptureOverlay {
    private app: ReturnType<typeof mount> | null = null;
    private target: HTMLDivElement | null = null;

    /** Mounts the CaptureProgress component in document.body. */
    mount(): void {
        if (this.app) return;
        this.target = document.createElement("div");
        document.body.append(this.target);
        this.app = mount(CaptureProgress as unknown as Component, {
            target: this.target,
            props: {
                presets: FIXTURE_PRESETS,
                onClose: () => this.close(),
            },
        });
    }

    /**
     * Updates a preset's status (live — Svelte re-renders via the component's internal $state).
     *
     * @param id       - Preset id (must match a FIXTURE_PRESETS entry).
     * @param state    - New state (navigating/capturing/ok/fail).
     * @param filename - Downloaded filename (for ok state), else null.
     */
    update(
        id: string,
        state: "pending" | "navigating" | "capturing" | "ok" | "fail",
        filename: string | null = null,
    ): void {
        // * Svelte 5 mount() returns the component instance; exported functions are accessible
        //   as methods on the returned object.
        const api = this.app as unknown as {
            update: (id: string, state: string, filename: string | null) => void;
        } | null;
        api?.update(id, state, filename);
    }

    /** Marks the batch as done — shows instructions + close button. */
    done(): void {
        const api = this.app as unknown as { done: () => void } | null;
        api?.done();
    }

    /** Unmounts the overlay + removes the target node. Called on close-button click. */
    close(): void {
        if (!this.app || !this.target) return;
        try {
            unmount(this.app);
        } catch (e) {
            console.error("[capture-overlay] unmount failed", e);
        }
        this.target.remove();
        this.app = null;
        this.target = null;
    }
}

/**
 * Captures ALL fixture presets sequentially via YouTube SPA navigation.
 *
 * One-click batch capture: for each preset, navigates to its `navUrl` (or captures the current
 * page when navUrl is absent/matching), waits for `yt-navigate-finish` + render delay, then
 * auto-downloads the fixture. SPA navigation keeps the JS context alive across pages.
 *
 * ! Must run in the real YouTube page (Tampermonkey, dev build). Playwright capture is blocked
 *   by YouTube's bot detection.
 *
 * @returns A summary of captured fixture filenames (or null where a preset matched no roots).
 */
export async function captureAllSequential(): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    console.info(`[capture-all] starting — ${FIXTURE_PRESETS.length} presets`);

    // * Progress overlay (Svelte component mounted in body — survives SPA nav). Shows live
    //   per-preset status + progress bar + post-batch instructions. Replaces the old alert-based
    //   feedback (alerts block, trigger Firefox multi-popup warnings, can't show live status).
    const overlay = new CaptureOverlay();
    overlay.mount();
    for (const preset of FIXTURE_PRESETS) {
        overlay.update(preset.id, "navigating");
        console.info(`[capture-all] "${preset.id}" (${preset.label})`);
        try {
            // * If the preset targets a different page, SPA-navigate there first.
            if (preset.navUrl && !samePage(location.href, preset.navUrl)) {
                const clicked = spaNavigate(preset.navUrl);
                if (clicked) {
                    await waitForNavigateFinish(15000);
                } else {
                    // * Fallback: no matching anchor found. Do NOT hard-navigate — a full
                    //   reload kills the JS context and the batch loop with it. Capture the
                    //   current page instead and log, so the run still yields a fixture.
                    console.warn(`[capture-all] SPA nav failed for "${preset.id}" — capturing current page`);
                }
            }
            overlay.update(preset.id, "capturing");
            const filename = captureFixture(preset);
            results[preset.id] = filename;
            overlay.update(preset.id, filename ? "ok" : "fail", filename);
            console.info(`[capture-all] "${preset.id}" → ${filename ?? "(no roots matched)"}`);
        } catch (e) {
            console.error(`[capture-all] "${preset.id}" failed:`, e);
            results[preset.id] = null;
            overlay.update(preset.id, "fail");
        }
    }
    const ok = Object.values(results).filter((v) => v !== null).length;
    console.info(`[capture-all] done — ${ok}/${FIXTURE_PRESETS.length} succeeded`, results);
    overlay.done();
    return results;
}
