import { onDestroy } from "svelte";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Scroll-Spy — highlights the active section based on scroll position
// ─────────────────────────────────────────────────────────────────────────────
// * IntersectionObserver-based: observes all `[data-section]` elements within a
//   scroll container. The topmost intersecting section (within the active band,
//   defined by rootMargin) becomes `activeSectionId`.
// * ! Must be called from an `$effect` (NOT onMount) — the container + sections are
//   already in the DOM when the effect runs. setup() is called directly, not via
//   onMount (which would never fire since the component is already mounted).
// * `setActive(id)` allows manual override (e.g. on section-button click or
//   category switch) for immediate indicator feedback. While the override is
//   active, the observer suppresses updates to intermediate sections the
//   smooth-scroll passes through — it only "locks in" once the target section
//   becomes the topmost intersecting, preventing indicator flicker.

/** Return handle from `createScrollSpy` — exposes the reactive active section id + cleanup. */
export interface ScrollSpy {
    /** Reactive id of the section currently in the active band, or null if none. */
    readonly activeSectionId: string | null;
    /** Manually sets the active section id (overrides scroll-spy until the target lands). */
    setActive: (id: string) => void;
    /**
     * Syncs the active section from the current scroll position WITHOUT setting an override.
     * Unlike `setActive`, this doesn't block observer updates — it immediately reads which
     * section is topmost and sets it as active. Used on category switch / mount when the
     * scroll position may be restored (non-zero) and forcing section[0] would be wrong.
     */
    syncFromScroll: () => void;
    /** Disconnects the observer and releases resources. Call on destroy. */
    destroy: () => void;
}

/**
 * Creates a scroll-spy that tracks which section is visible within a scroll container.
 *
 * Uses an IntersectionObserver with `rootMargin: "0px 0px -70% 0px"` so the top ~30%
 * band of the viewport (relative to the scroll container) counts as "active" — this
 * avoids flapping when multiple sections are partially visible.
 *
 * ! Called from an `$effect` — `setup()` runs immediately (container is in DOM).
 *   `destroy()` is registered via `onDestroy` for component teardown.
 *
 * @param containerEl - The scroll container element (the `.yt-tweaks-content` div).
 * @param sectionIds  - The section ids to observe (must match `data-section` attrs).
 * @returns A ScrollSpy handle with reactive `activeSectionId`, `setActive`, + `destroy()`.
 */
export function createScrollSpy(containerEl: HTMLElement, sectionIds: string[]): ScrollSpy {
    let activeSectionId = $state<string | null>(sectionIds[0] ?? null);
    let observer: IntersectionObserver | null = null;
    let scrollRaf: number | null = null;
    // * Latest entries — rAF reads these, not the stale closure entries (fixes:
    //   during smooth-scroll multiple observer callbacks fire, the debounce must
    //   use the LATEST entries, not drop them).
    let pendingEntries: IntersectionObserverEntry[] = [];
    // * Manual override: when user clicks a section button or switches category,
    //   setActive(id) sets this. The observer then suppresses updates to
    //   intermediate sections until the TARGET (overrideId) is the topmost
    //   intersecting — then it clears the override and takes over. Prevents the
    //   indicator from flickering through every section the smooth-scroll passes.
    let overrideId: string | null = null;

    function processEntries(): void {
        scrollRaf = null;
        const visible = pendingEntries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = visible[0].target.getAttribute("data-section");
        if (!topId) return;
        if (overrideId !== null) {
            // * Suppress intermediate sections — only lock in when the override
            //   target is the topmost intersecting.
            if (topId === overrideId) overrideId = null;
            else return;
        }
        activeSectionId = topId;
    }

    function setup(): void {
        if (!containerEl) return;
        observer?.disconnect();
        observer = new IntersectionObserver(
            (entries) => {
                pendingEntries = entries;
                if (scrollRaf !== null) return;
                scrollRaf = requestAnimationFrame(processEntries);
            },
            {
                root: containerEl,
                // * Top ~30% band counts as active (0% top margin, 70% bottom margin).
                rootMargin: "0px 0px -70% 0px",
                threshold: 0,
            },
        );
        for (const id of sectionIds) {
            const el = containerEl.querySelector(`[data-section="${id}"]`);
            if (el) observer.observe(el);
        }
    }

    function setActive(id: string): void {
        // * Immediate indicator feedback on click/category-switch. The observer
        //   suppresses intermediate updates until the target lands in the active band.
        overrideId = id;
        activeSectionId = id;
    }

    function syncFromScroll(): void {
        // * Read which section is currently topmost from the live scroll position — no override.
        //   Used on mount/category-switch when the scroll position may be restored (non-zero),
        //   where forcing setActive(sections[0]) would set an override that never resolves
        //   (section[0] never becomes topmost) and block all observer updates.
        if (!containerEl) return;
        const containerRect = containerEl.getBoundingClientRect();
        const activeBandBottom = containerRect.top + containerRect.height * 0.3;
        let topId: string | null = null;
        for (const id of sectionIds) {
            const el = containerEl.querySelector(`[data-section="${id}"]`) as HTMLElement | null;
            if (!el) continue;
            const elTop = el.getBoundingClientRect().top;
            if (elTop <= activeBandBottom) topId = id;
            else break;
        }
        if (topId) activeSectionId = topId;
    }

    function destroy(): void {
        if (scrollRaf !== null) {
            cancelAnimationFrame(scrollRaf);
            scrollRaf = null;
        }
        observer?.disconnect();
        observer = null;
    }

    // * Call setup() directly (not via onMount — invoked from an $effect,
    //   the component is already mounted, the DOM is ready).
    setup();
    onDestroy(destroy);

    return {
        get activeSectionId() {
            return activeSectionId;
        },
        setActive,
        syncFromScroll,
        destroy,
    };
}
