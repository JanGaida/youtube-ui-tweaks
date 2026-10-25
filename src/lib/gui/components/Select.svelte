<script lang="ts">
    /**
     * Select: binds to a store dot-path. With `num=true` the value is stored as a number.
     *
     * ! Only use `num=true` when the settings field is genuinely numeric — a string-enum field
     *   coerced to a number breaks strict-equality comparisons in the feature code.
     *
     * Custom dropdown (DD7 Two-Line Rich) replacing the native `<select>`. Renders a Field-native
     * trigger and a Floating Popout (position:fixed, clipping-safe). The popout escapes the scroll
     * container `.yt-tweaks-content` (overflow-y:auto) because `.yt-tweaks-panel` is itself
     * `position:fixed` with no persistent `transform` — so a `position:fixed` child uses the
     * viewport as its containing block, not the scroll container. (A Svelte-portal to `body` was
     * considered and rejected: the panel is already viewport-fixed and untransformed, and an inline
     * position:fixed popout avoids R4 YT-CSS-context risk.)
     *
     * Each option shows a label plus an optional `desc` subtitle (two-line). Selected option shows
     * a checkmark + tint.
     *
     * Reposition-on-scroll: while open, the popout follows the trigger on scroll/resize via a
     * `requestAnimationFrame`-throttled `getBoundingClientRect` recalc (passive listeners).
     * Closes on Escape, click-outside, or trigger toggle.
     *
     * A11y: `role="listbox"` on the popout, `role="option"` per row, `aria-expanded` + `aria-controls`
     * on the trigger, `aria-activedescendant` for the active option, `aria-selected` per option.
     * Keyboard: ArrowUp/Down move the active option, Enter selects, Escape closes, Tab closes,
     * Home/End jump. The trigger is a `<button>` (native Tab-stop + focus-visible).
     *
     * Trusted-Types-safe: rendered via Svelte templates (`textContent` semantics), no `innerHTML`.
     *
     * `onChange`: optional side-effect callback (fires after `store.setByPath`, with the resolved
     * value). Useful when an immediate effect is needed (e.g. `setLogLevel`) that the debounced
     * live-apply wouldn't trigger fast enough.
     */
    import { onMount, onDestroy } from "svelte";
    import { store } from "../../stores/settings.svelte";

    /** Option entry for the select control. `desc` is the subtitle shown in the popout. */
    export interface SelectOption {
        value: string;
        label: string;
        desc?: string;
    }

    let {
        path,
        options,
        num = false,
        onChange,
    }: {
        path: string;
        options: SelectOption[];
        num?: boolean;
        /** Optional side-effect callback (fires after setByPath, with the resolved value). */
        onChange?: (value: string | number) => void;
    } = $props();

    const currentValue = $derived(String(store.getByPath(path)));

    // ─── Open/active state ─────────────────────────────────────────────────────
    let isOpen = $state(false);
    // * activeIndex = keyboard-focused option (distinct from selected). -1 = none.
    let activeIndex = $state(-1);
    let triggerEl: HTMLButtonElement | null = $state(null);
    let popoutEl: HTMLDivElement | null = $state(null);

    // ─── Derived: selected option ──────────────────────────────────────────────
    const selectedOpt = $derived(options.find((o) => o.value === currentValue) ?? options[0]);

    // ─── Popout positioning (reposition-on-scroll, rAF-throttled) ───────────────
    // * Two SEPARATE rAF ids: reposition and scroll-into-view are unrelated mechanisms —
    //   sharing one id makes them suppress each other (a pending scroll-into-view would
    //   skip a reposition frame and vice versa).
    let repositionRafId: number | null = null;
    let scrollRafId: number | null = null;

    /**
     * Positions the popout below the trigger using its bounding rect. Flips above if there
     * is not enough space below; clamps horizontally into the viewport.
     */
    function positionPopout(): void {
        if (!triggerEl || !popoutEl) return;
        const r = triggerEl.getBoundingClientRect();
        const pw = popoutEl.offsetWidth;
        const ph = popoutEl.offsetHeight;
        let left = r.left;
        let top = r.bottom + 4;
        if (top + ph > window.innerHeight - 8) top = r.top - ph - 4;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (left < 8) left = 8;
        popoutEl.style.left = `${left}px`;
        popoutEl.style.top = `${top}px`;
    }

    /** rAF-throttled reposition (called from scroll/resize listeners while open). */
    function scheduleReposition(): void {
        if (repositionRafId !== null) return;
        repositionRafId = requestAnimationFrame(() => {
            repositionRafId = null;
            positionPopout();
        });
    }

    // ─── Open / close ──────────────────────────────────────────────────────────
    function open(): void {
        isOpen = true;
        activeIndex = options.findIndex((o) => o.value === currentValue);
        if (activeIndex < 0) activeIndex = 0;
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        activeIndex = -1;
        if (repositionRafId !== null) {
            cancelAnimationFrame(repositionRafId);
            repositionRafId = null;
        }
        if (scrollRafId !== null) {
            cancelAnimationFrame(scrollRafId);
            scrollRafId = null;
        }
    }

    function toggle(): void {
        if (isOpen) close();
        else open();
    }

    // ─── Selection ─────────────────────────────────────────────────────────────
    function selectValue(value: string): void {
        const val = num ? Number(value) : value;
        store.setByPath(path, val);
        onChange?.(val);
    }

    function onOptionClick(value: string): void {
        selectValue(value);
        close();
        triggerEl?.focus();
    }

    // ─── Keyboard navigation ───────────────────────────────────────────────────
    function onKeyDown(e: KeyboardEvent): void {
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
            }
            return;
        }
        const last = options.length - 1;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                activeIndex = activeIndex >= last ? 0 : activeIndex + 1;
                scrollActiveIntoView();
                break;
            case "ArrowUp":
                e.preventDefault();
                activeIndex = activeIndex <= 0 ? last : activeIndex - 1;
                scrollActiveIntoView();
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < options.length) {
                    onOptionClick(options[activeIndex].value);
                }
                break;
            case "Escape":
                e.preventDefault();
                close();
                triggerEl?.focus();
                break;
            case "Tab":
                close();
                break;
            case "Home":
                e.preventDefault();
                activeIndex = 0;
                scrollActiveIntoView();
                break;
            case "End":
                e.preventDefault();
                activeIndex = last;
                scrollActiveIntoView();
                break;
        }
    }

    function scrollActiveIntoView(): void {
        if (scrollRafId !== null) return;
        scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null;
            const row = popoutEl?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
            row?.scrollIntoView({ block: "nearest" });
        });
    }

    // ─── Click-outside + reposition listeners ──────────────────────────────────
    function onDocumentPointerDown(e: PointerEvent): void {
        if (!isOpen) return;
        const target = e.target as Node | null;
        if (popoutEl?.contains(target)) return;
        if (triggerEl?.contains(target)) return;
        close();
    }

    function onScrollOrResize(): void {
        if (!isOpen) return;
        scheduleReposition();
    }

    onMount(() => {
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
        window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
        window.addEventListener("resize", onScrollOrResize, { passive: true });
    });

    onDestroy(() => {
        document.removeEventListener("pointerdown", onDocumentPointerDown, true);
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
        if (repositionRafId !== null) cancelAnimationFrame(repositionRafId);
        if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
    });

    // * Reposition once the popout mounts (after isOpen flips true → Svelte renders it).
    $effect(() => {
        if (isOpen && popoutEl) {
            positionPopout();
        }
    });

    // ─── IDs for aria wiring (unique per instance) ──────────────────────────────
    const uid = `yt-dd-${Math.random().toString(36).slice(2, 9)}`;
    const listboxId = `${uid}-listbox`;
</script>

<div class="yt-tweaks-dropdown">
    <button
        bind:this={triggerEl}
        type="button"
        role="combobox"
        class="yt-tweaks-dropdown-trigger"
        class:open={isOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined}
        onclick={toggle}
        onkeydown={onKeyDown}
    >
        <span class="yt-tweaks-dropdown-trigger-label">{selectedOpt?.label ?? ""}</span>
        <svg
            class="yt-tweaks-dropdown-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg
        >
    </button>
</div>

{#if isOpen}
    <div bind:this={popoutEl} id={listboxId} class="yt-tweaks-dropdown-popout" role="listbox">
        {#each options as opt, i (opt.value)}
            <div
                id={`${uid}-opt-${i}`}
                class="yt-tweaks-dropdown-opt"
                class:selected={opt.value === currentValue}
                class:active={i === activeIndex}
                role="option"
                aria-selected={opt.value === currentValue}
                data-idx={i}
                data-val={opt.value}
                tabindex="-1"
                onclick={() => onOptionClick(opt.value)}
                onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOptionClick(opt.value);
                    }
                }}
                onpointerenter={() => (activeIndex = i)}
            >
                <span class="yt-tweaks-dropdown-opt-text">
                    <span class="yt-tweaks-dropdown-opt-label">{opt.label}</span>
                    {#if opt.desc}<span class="yt-tweaks-dropdown-opt-desc">{opt.desc}</span>{/if}
                </span>
                <svg
                    class="yt-tweaks-dropdown-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5" /></svg
                >
            </div>
        {/each}
    </div>
{/if}
