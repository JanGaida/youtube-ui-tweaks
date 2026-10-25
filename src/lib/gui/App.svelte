<script lang="ts">
    /**
     * Settings panel root: header (drag), backdrop, ESC/close, resize handles, category
     * sidebar (9 categories), scroll-spy section navigation, iconbar
     * (export/import/reset/github), and the category panes.
     *
     * Navigation model (replaces the old tab + accordion + group hierarchy):
     * - Sidebar: 9 categories (video-item, menubar, guide-sidebar, feed-chips, startpage, watch-page, ads-promotions, system, about).
     * - Content: flat sections; the CategorySidebar's section sub-list tracks the active
     *   section via scroll-spy and highlights it.
     * - Clicking a section button smooth-scrolls to the section (no setTimeout, no registry).
     *
     * Save-on-close: closing via backdrop/ESC/close-button persists settings and triggers
     * live-apply. Reset restores defaults with confirmation.
     *
     * A11y: modal focus trap (Tab cycles within the panel), Escape closes, resize handles
     * are focusable buttons with arrow-key resize. Panel drag is a deliberate mouse gesture
     * (position is cosmetic; everything is reachable without it).
     */
    import { onMount, onDestroy, untrack, tick } from "svelte";
    import Icon from "./components/Icon.svelte";
    import CategorySidebar from "./components/CategorySidebar.svelte";
    import VideoItemTab from "./tabs/VideoItemTab.svelte";
    import MenubarTab from "./tabs/MenubarTab.svelte";
    import GuideSidebarTab from "./tabs/GuideSidebarTab.svelte";
    import FeedChipsTab from "./tabs/FeedChipsTab.svelte";
    import StartpageTab from "./tabs/StartpageTab.svelte";
    import WatchPageTab from "./tabs/WatchPageTab.svelte";
    import AdsPromotionsTab from "./tabs/AdsPromotionsTab.svelte";
    import SystemTab from "./tabs/SystemTab.svelte";
    import AboutTab from "./tabs/AboutTab.svelte";
    import { CATEGORIES, getDefaultCategoryId, type CategoryId } from "./navigation/categories";
    import { createScrollSpy, type ScrollSpy } from "./navigation/scrollSpy.svelte";
    import { masonry } from "./navigation/section-masonry";
    import { SUB_ICONS } from "./icons";
    import { store } from "../stores/settings.svelte";
    import { getPanelPos, savePanelPos, getPanelUi, savePanelUi, type PanelUiState } from "../core/settings";
    import { applyToggleState } from "../core/system-toggle";
    import { applyAnonymize } from "../core/anonymize";
    import { setLogLevel, LOG_LEVEL_LABELS, LOG_LEVEL } from "../core/log";
    import { STYLE_ID } from "../core/css";
    import { currentLocale, isObserverRunning } from "../core/observer";
    import { getPageCtx } from "../core/page";
    import { getFeatures, resolveBehavior } from "../core/registry";
    import { t } from "./i18n.svelte";
    import type { DebugStats } from "./types";
    import "./panel.css";
    import iconUrl from "../../assets/icon.svg?url";

    // ! Keep in sync with AboutTab.svelte — a release must update the URL in BOTH places
    //   (a define-injected constant would remove the drift risk, but vite-plugin-monkey's
    //   `define` values land in the userscript header, not the GUI — tracked as Open Work).
    const GITHUB_URL = "https://github.com/JanGaida/youtube-ui-tweaks";

    // * Props: close callback (for backdrop/ESC/close-button).
    let { onClose }: { onClose: () => void } = $props();

    // * Active category — from the persisted UI state or the default (video-item).
    let activeCategory = $state<CategoryId>(
        (() => {
            const ui = getPanelUi();
            const cats = CATEGORIES.map((c) => c.id);
            return (
                ui && cats.includes(ui.activeCategory as CategoryId) ? ui.activeCategory : getDefaultCategoryId()
            ) as CategoryId;
        })(),
    );

    // * Per-category scroll positions within THIS panel session. Restoring on switch-back
    //   beats always jumping to top. Panel reopen restores from the persisted UI state
    //   (getPanelUi) instead — this map is deliberately session-local.
    const categoryScroll = new Map<CategoryId, number>();

    // * Persists the active tab + its current scroll position (survives panel reopen).
    function persistPanelUi(): void {
        if (!contentEl) return;
        const state: PanelUiState = {
            activeCategory,
            scrollTop: contentEl.scrollTop,
        };
        savePanelUi(state);
    }

    function switchCategory(catId: CategoryId): void {
        // * Remember the old category's scroll position, then switch + restore the new
        //   one's last position (top on first visit).
        if (contentEl) categoryScroll.set(activeCategory, contentEl.scrollTop);
        activeCategory = catId;
        if (contentEl) contentEl.scrollTop = categoryScroll.get(catId) ?? 0;
    }

    // * Debug stats (refreshed periodically)
    let stats = $state<DebugStats>({
        "Tweaks enabled": "",
        Anonymize: "",
        "Active level": "",
        Locale: "",
        Page: "",
        "Active features": "",
        "CSS style mounted": "",
        "Texts shortened": "",
        "Elements hidden": "",
        Observer: "",
    });

    let statsInterval: ReturnType<typeof setInterval> | null = null;

    function updateStats(): void {
        const textCount = document.querySelectorAll('[data-yt-tweaked="1"]').length;
        const hiddenCount = document.querySelectorAll("[data-yt-tweaks-hidden]").length;
        const styleMounted = document.getElementById(STYLE_ID) ? "yes" : "no";
        let page = "?";
        let activeFeatures = "0";
        try {
            const ctx = getPageCtx();
            page = ctx.page;
            activeFeatures = String(getFeatures().filter((f) => resolveBehavior(f, ctx.page)).length);
        } catch {
            // * PageContext not initialized yet.
        }
        stats = {
            "Tweaks enabled": store.getByPath("system.tweaksEnabled") ? "yes" : "no (clean state)",
            Anonymize: store.getByPath("system.anonymize") ? "on" : "off",
            "Active level": LOG_LEVEL_LABELS[LOG_LEVEL] ?? "info",
            Locale: currentLocale,
            Page: page,
            "Active features": activeFeatures,
            "CSS style mounted": styleMounted,
            "Texts shortened": String(textCount),
            "Elements hidden": String(hiddenCount),
            Observer: isObserverRunning() ? "running" : "stopped",
        };
    }

    // * Panel size from the store (reactive) — values in vw/vh percentages.
    const panelWidth = $derived(`${store.getByPath("gui.widthPct")}vw`);
    const panelHeight = $derived(`${store.getByPath("gui.heightPct")}vh`);
    // * Backdrop opacity — rgba inline (GUI CSS, not YouTube).
    const backdropOpacity = $derived(Number(store.getByPath("gui.backdropOpacity")) / 100);

    // * Panel ref for drag + position; content ref for scroll-spy.
    let panelEl = $state<HTMLDivElement | null>(null);
    let contentEl = $state<HTMLDivElement | null>(null);

    // * Active category definition (reactive)
    const activeCatDef = $derived(CATEGORIES.find((c) => c.id === activeCategory)!);

    // * Scroll-spy: rebuilt when the category or content element changes.
    //   Reactive via $effect — observes activeCategory + contentEl.
    // * ! `scrollSpy` is NOT read in the effect body (only written via untrack) —
    //   otherwise the mutation would re-trigger the effect → infinite loop → broken nav.
    let scrollSpy = $state<ScrollSpy | null>(null);

    // * Active section id (reactive from scrollSpy) — passed to the CategorySidebar.
    const activeSectionId = $derived(scrollSpy?.activeSectionId ?? activeCatDef.sections[0]?.id ?? null);

    $effect(() => {
        // * Dependencies: activeCategory (determines sections + content) + contentEl (scroll root).
        const _cat = activeCategory;
        const _content = contentEl;
        if (!_content) return;
        // * Cancel flag: ESC can close the panel (and tear this effect down) BEFORE the
        //   pending tick() resolves — without the flag the callback would create a spy on
        //   a detached DOM tree, leaking its IntersectionObserver (its onDestroy would be
        //   a no-op at that point) and potentially a pending rAF.
        let cancelled = false;
        // * New sections are only available after the DOM patch — tick() awaits the render.
        //   Without tick() the spy would miss the new category's sections.
        tick().then(() => {
            if (cancelled) return;
            const cat = CATEGORIES.find((c) => c.id === activeCategory);
            const sections = cat ? cat.sections.map((s) => s.id) : [];
            untrack(() => scrollSpy?.destroy());
            const spy = createScrollSpy(_content, sections);
            // * Sync active section from the CURRENT scroll position (may be restored > 0).
            //   Using syncFromScroll (not setActive) avoids setting an overrideId that would
            //   block observer updates if section[0] never becomes topmost (scroll > 0).
            spy.syncFromScroll();
            untrack(() => (scrollSpy = spy));
        });
        return () => {
            cancelled = true;
            untrack(() => {
                scrollSpy?.destroy();
                scrollSpy = null;
            });
        };
    });

    // * Section click: instant indicator update (setActive) + smooth-scroll.
    //   Sections are always visible → no expand, no setTimeout, no registry.
    function scrollToSection(sectionId: string): void {
        scrollSpy?.setActive(sectionId);
        if (!contentEl) return;
        const target = contentEl.querySelector(`[data-section="${sectionId}"]`) as HTMLElement | null;
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // * Resize (8 handles: edges + corners). The drag writes gui.widthPct/heightPct
    //   directly into the store → the Stepper syncs reactively. vw/vh = px/viewportSize*100.
    type ResizeDir = { e?: boolean; w?: boolean; n?: boolean; s?: boolean };

    // * Resize handlers are tracked module-side (like the header-drag handlers below) so
    //   onDestroy can detach them — pressing ESC mid-gesture closes the panel, and a
    //   closure-scoped listener pair would keep writing to the destroyed panel state.
    let resizeMove: ((e: MouseEvent) => void) | null = null;
    let resizeUp: (() => void) | null = null;

    function startResize(e: MouseEvent, dir: ResizeDir): void {
        if (!panelEl) return;
        e.preventDefault();
        e.stopPropagation();
        const startRect = panelEl.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = startRect.width;
        const startH = startRect.height;
        const startLeft = startRect.left;
        const startTop = startRect.top;
        // * Keep the pixel guards in sync with the pct clamp below — a px min BELOW the
        //   pct clamp (e.g. 200px when 30vw = 576px on a 1920 viewport) is unreachable and
        //   the derived panel size would snap back mid-gesture.
        const minW = Math.max(200, Math.round(window.innerWidth * 0.3));
        const minH = Math.max(150, Math.round(window.innerHeight * 0.3));

        resizeMove = (ev: MouseEvent): void => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let newW = startW;
            let newH = startH;
            let newLeft = startLeft;
            let newTop = startTop;

            if (dir.e) newW = startW + dx;
            if (dir.w) {
                newW = startW - dx;
                newLeft = startLeft + dx;
            }
            if (dir.s) newH = startH + dy;
            if (dir.n) {
                newH = startH - dy;
                newTop = startTop + dy;
            }

            // * Negative/minimum guard
            if (newW < minW) {
                newW = minW;
                if (dir.w) newLeft = startLeft + (startW - minW);
            }
            if (newH < minH) {
                newH = minH;
                if (dir.n) newTop = startTop + (startH - minH);
            }

            const wPct = Math.round((newW / window.innerWidth) * 100);
            const hPct = Math.round((newH / window.innerHeight) * 100);
            store.setByPath("gui.widthPct", Math.max(30, Math.min(90, wPct)));
            store.setByPath("gui.heightPct", Math.max(30, Math.min(90, hPct)));

            // * Adjust the position when pulled from the left/top (otherwise the panel jumps)
            if (panelEl) {
                if (dir.w || dir.n) {
                    panelEl.style.transform = "none";
                    panelEl.style.left = newLeft + "px";
                    panelEl.style.top = newTop + "px";
                }
            }
        };
        resizeUp = (): void => {
            if (resizeMove) document.removeEventListener("mousemove", resizeMove);
            if (resizeUp) document.removeEventListener("mouseup", resizeUp);
            resizeMove = null;
            resizeUp = null;
            // * Persist the position (same as the header drag)
            if (panelEl) {
                const r = panelEl.getBoundingClientRect();
                savePanelPos({ top: r.top, left: r.left });
            }
            // * Bug fix: the drag can end with a mouseup OUTSIDE the panel → the browser
            //   then fires a stray click on the backdrop ancestor → would close the panel.
            //   Fix: swallow exactly the NEXT click, once (capture, before the backdrop).
            //   ! Side effect: that next click is swallowed even when unrelated to the
            //     drag — acceptable, it self-removes after one click.
            const swallowClick = (ev: MouseEvent): void => {
                ev.stopPropagation();
                document.removeEventListener("click", swallowClick, true);
            };
            document.addEventListener("click", swallowClick, true);
        };
        document.addEventListener("mousemove", resizeMove);
        document.addEventListener("mouseup", resizeUp);
    }

    // * Keyboard resize (a11y): the handles are focusable buttons; arrow keys resize by a
    //   fixed step. n/s handles use Up/Down, e/w handles Left/Right, corners all four keys.
    //   Home/End shrink/grow on both axes (like dragging a corner toward/away from center).
    const KEY_RESIZE_STEP = 60;
    function onHandleKeydown(e: KeyboardEvent, dir: ResizeDir): void {
        if (!panelEl) return;
        let dW = 0;
        let dH = 0;
        if (e.key === "ArrowUp" && (dir.n || dir.s)) {
            e.preventDefault();
            dH = dir.n ? KEY_RESIZE_STEP : -KEY_RESIZE_STEP;
        } else if (e.key === "ArrowDown" && (dir.n || dir.s)) {
            e.preventDefault();
            dH = dir.n ? -KEY_RESIZE_STEP : KEY_RESIZE_STEP;
        } else if (e.key === "ArrowLeft" && (dir.e || dir.w)) {
            e.preventDefault();
            dW = dir.e ? -KEY_RESIZE_STEP : KEY_RESIZE_STEP;
        } else if (e.key === "ArrowRight" && (dir.e || dir.w)) {
            e.preventDefault();
            dW = dir.e ? KEY_RESIZE_STEP : -KEY_RESIZE_STEP;
        } else if (e.key === "Home") {
            e.preventDefault();
            dW = -KEY_RESIZE_STEP;
            dH = -KEY_RESIZE_STEP;
        } else if (e.key === "End") {
            e.preventDefault();
            dW = KEY_RESIZE_STEP;
            dH = KEY_RESIZE_STEP;
        } else {
            return;
        }
        const r = panelEl.getBoundingClientRect();
        const wPct = Math.round(((r.width + dW) / window.innerWidth) * 100);
        const hPct = Math.round(((r.height + dH) / window.innerHeight) * 100);
        store.setByPath("gui.widthPct", Math.max(30, Math.min(90, wPct)));
        store.setByPath("gui.heightPct", Math.max(30, Math.min(90, hPct)));
    }

    let dragMove: ((e: MouseEvent) => void) | null = null;
    let dragUp: (() => void) | null = null;

    function onHeaderMouseDown(e: MouseEvent): void {
        if (!panelEl) return;
        if ((e.target as HTMLElement).closest(".yt-tweaks-close")) return;
        const rect = panelEl.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const pw = rect.width;
        const ph = rect.height;
        panelEl.style.transform = "none";
        panelEl.style.left = rect.left + "px";
        panelEl.style.top = rect.top + "px";
        panelEl.style.margin = "0";

        dragMove = (ev: MouseEvent) => {
            const x = ev.clientX - offsetX;
            const y = ev.clientY - offsetY;
            const cx = Math.max(0, Math.min(window.innerWidth - pw, x));
            const cy = Math.max(0, Math.min(window.innerHeight - ph, y));
            panelEl!.style.left = cx + "px";
            panelEl!.style.top = cy + "px";
        };
        dragUp = () => {
            if (!panelEl) return;
            const r = panelEl.getBoundingClientRect();
            savePanelPos({ top: r.top, left: r.left });
            if (dragMove) document.removeEventListener("mousemove", dragMove);
            if (dragUp) document.removeEventListener("mouseup", dragUp);
            dragMove = null;
            dragUp = null;
            // * Bug fix: see startResize — swallow the stray click after the drag.
            const swallowClick = (ev: MouseEvent): void => {
                ev.stopPropagation();
                document.removeEventListener("click", swallowClick, true);
            };
            document.addEventListener("click", swallowClick, true);
        };
        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragUp);
    }

    // * ESC closes (with save). Tab is trapped inside the modal panel (a11y focus trap).
    const FOCUSABLE_SEL =
        'a[href], button:not([disabled]), input:not([disabled]):not([type="file"]), select, textarea, [tabindex]:not([tabindex="-1"])';

    /** Traps Tab/Shift+Tab inside the panel — without it, Tab escapes into YouTube's DOM. */
    function trapFocus(e: KeyboardEvent): void {
        if (e.key !== "Tab" || !panelEl) return;
        const focusables = Array.from(panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
            if (active === first || !panelEl.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (active === last || !panelEl.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function onKeydown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            closePanel();
            return;
        }
        trapFocus(e);
    }

    // * Scroll persistence: debounced save while the content area scrolls.
    let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
    function onContentScroll(): void {
        if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
        scrollSaveTimer = setTimeout(persistPanelUi, 200);
    }

    onMount(() => {
        // * Restore the panel position — only when its age <= gui.posMaxAgeHours.
        //   posMaxAgeHours=0 or expired → null → default (centered via CSS).
        const pos = getPanelPos(Number(store.getByPath("gui.posMaxAgeHours")));
        if (pos && panelEl) {
            panelEl.style.left = pos.left + "px";
            panelEl.style.top = pos.top + "px";
            panelEl.style.transform = "none";
        }
        // * Restore the content scroll position (persisted via getPanelUi).
        if (contentEl) {
            const ui = getPanelUi();
            contentEl.scrollTop = ui && ui.activeCategory === activeCategory ? ui.scrollTop : 0;
            contentEl.addEventListener("scroll", onContentScroll, { passive: true });
        }
        updateStats();
        statsInterval = setInterval(updateStats, 1000);
        document.addEventListener("keydown", onKeydown);
        // * Move focus into the modal on open (keyboard users land on the close button).
        panelEl?.querySelector<HTMLElement>(".yt-tweaks-close")?.focus();
    });

    onDestroy(() => {
        if (statsInterval) clearInterval(statsInterval);
        if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
        if (contentEl) contentEl.removeEventListener("scroll", onContentScroll);
        if (dragMove) document.removeEventListener("mousemove", dragMove);
        if (dragUp) document.removeEventListener("mouseup", dragUp);
        if (resizeMove) document.removeEventListener("mousemove", resizeMove);
        if (resizeUp) document.removeEventListener("mouseup", resizeUp);
        document.removeEventListener("keydown", onKeydown);
        scrollSpy?.destroy();
    });

    // * Close = save (save-on-close). There is no save button.
    //   Backdrop click / ESC / close button → all via onClose → save().
    function closePanel(): void {
        // * Force-blur the focused control first: blur handlers clamp Stepper inputs and
        //   finalize text fields — an ESC close would otherwise persist raw mid-edit values.
        (document.activeElement as HTMLElement | null)?.blur?.();
        persistPanelUi();
        store.save();
        onClose();
    }

    // * Reset: with confirmation. store.reset() persists the defaults AND performs the full
    //   feature restore pass (registry restoreAll + re-run) — no manual restore calls needed.
    //   The panel stays open.
    function onReset(): void {
        if (!confirm(t("msg.resetConfirm"))) return;
        store.reset();
        // * Sync toggle states after the reset: defaults are tweaksEnabled=true, anonymize=false.
        //   applyToggleState(true) restarts the observer + CSS; applyAnonymize(false) removes the layer.
        applyToggleState(true);
        applyAnonymize(false);
    }

    // * Export/import (iconbar) — no file input in the panel state, created ad hoc.
    function onExport(): void {
        const json = store.exportJson();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "youtube-ui-tweaks-settings.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function onImport(): void {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            file.text().then((text) => {
                try {
                    store.importJson(text);
                } catch (err) {
                    console.error("[YT-Tweaks] import failed", err);
                    alert(t("msg.importFailed"));
                }
            });
        };
        input.click();
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- * Backdrop = modal overlay. Click-to-close is a UX convenience; the keyboard equivalent
     is the global Escape handler (onKeydown). Not an interactive element → role=presentation. -->
<div
    class="yt-tweaks-backdrop"
    role="presentation"
    style="background: rgba(0,0,0,{backdropOpacity});"
    onclick={(e) => {
        if (e.target === e.currentTarget) closePanel();
    }}
>
    <div class="yt-tweaks-panel" bind:this={panelEl} style="width: {panelWidth}; height: {panelHeight};">
        <!-- * Resize handles: focusable buttons (a11y) — arrow keys resize, mouse drag works
             as before. Labels are screen-reader-only. -->
        <div class="yt-tweaks-resize-handles">
            <button
                type="button"
                class="yt-tweaks-rh n"
                aria-label={t("a11y.resizeNorth")}
                onmousedown={(e) => startResize(e, { n: true })}
                onkeydown={(e) => onHandleKeydown(e, { n: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh s"
                aria-label={t("a11y.resizeSouth")}
                onmousedown={(e) => startResize(e, { s: true })}
                onkeydown={(e) => onHandleKeydown(e, { s: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh e"
                aria-label={t("a11y.resizeEast")}
                onmousedown={(e) => startResize(e, { e: true })}
                onkeydown={(e) => onHandleKeydown(e, { e: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh w"
                aria-label={t("a11y.resizeWest")}
                onmousedown={(e) => startResize(e, { w: true })}
                onkeydown={(e) => onHandleKeydown(e, { w: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh ne"
                aria-label={t("a11y.resizeNorthEast")}
                onmousedown={(e) => startResize(e, { n: true, e: true })}
                onkeydown={(e) => onHandleKeydown(e, { n: true, e: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh nw"
                aria-label={t("a11y.resizeNorthWest")}
                onmousedown={(e) => startResize(e, { n: true, w: true })}
                onkeydown={(e) => onHandleKeydown(e, { n: true, w: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh se"
                aria-label={t("a11y.resizeSouthEast")}
                onmousedown={(e) => startResize(e, { s: true, e: true })}
                onkeydown={(e) => onHandleKeydown(e, { s: true, e: true })}
            ></button>
            <button
                type="button"
                class="yt-tweaks-rh sw"
                aria-label={t("a11y.resizeSouthWest")}
                onmousedown={(e) => startResize(e, { s: true, w: true })}
                onkeydown={(e) => onHandleKeydown(e, { s: true, w: true })}
            ></button>
        </div>
        <!-- * Header drag = deliberate mouse gesture (drag-and-drop), no keyboard action:
             the position is cosmetic, everything is reachable without it.
             role=presentation instead of toolbar (no toolbar functionality). -->
        <div class="yt-tweaks-header" id="yt-tweaks-header" role="presentation" onmousedown={onHeaderMouseDown}>
            <span class="yt-tweaks-title"
                ><img class="yt-tweaks-title-icon" src={iconUrl} alt="" /> YouTube UI Tweaks</span
            >
            <button class="yt-tweaks-close" id="yt-tweaks-close" title={t("close.title")} onclick={closePanel}>✕</button
            >
        </div>

        <div class="yt-tweaks-main">
            <div class="yt-tweaks-sidebar">
                <CategorySidebar
                    categories={CATEGORIES}
                    activeCategoryId={activeCategory}
                    {activeSectionId}
                    onSelectCategory={switchCategory}
                    onSelectSection={scrollToSection}
                />
                <div class="yt-tweaks-iconbar">
                    <button class="yt-tweaks-iconbar-btn" title={t("btn.export")} onclick={onExport}>
                        <Icon path={SUB_ICONS.export} size={18} />
                    </button>
                    <button class="yt-tweaks-iconbar-btn" title={t("btn.import")} onclick={onImport}>
                        <Icon path={SUB_ICONS.import} size={18} />
                    </button>
                    <button class="yt-tweaks-iconbar-btn" title={t("btn.reset")} onclick={onReset}>
                        <Icon path={SUB_ICONS.reset} size={18} />
                    </button>
                    <a
                        class="yt-tweaks-iconbar-btn yt-tweaks-iconbar-btn--filled"
                        title="GitHub"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Icon path={SUB_ICONS.github} size={20} filled />
                    </a>
                </div>
            </div>

            <div class="yt-tweaks-content" bind:this={contentEl}>
                <div class="yt-tweaks-section-list" use:masonry>
                    {#if activeCategory === "video-item"}
                        <VideoItemTab />
                    {:else if activeCategory === "menubar"}
                        <MenubarTab />
                    {:else if activeCategory === "guide-sidebar"}
                        <GuideSidebarTab />
                    {:else if activeCategory === "feed-chips"}
                        <FeedChipsTab />
                    {:else if activeCategory === "startpage"}
                        <StartpageTab />
                    {:else if activeCategory === "watch-page"}
                        <WatchPageTab />
                    {:else if activeCategory === "ads-promotions"}
                        <AdsPromotionsTab />
                    {:else if activeCategory === "system"}
                        <SystemTab {stats} />
                    {:else if activeCategory === "about"}
                        <AboutTab />
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
