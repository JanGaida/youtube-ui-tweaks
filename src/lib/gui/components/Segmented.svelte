<script lang="ts">
    /**
     * Segmented: a compact multi-option selector (segmented control) bound to a store dot-path.
     *
     * Renders all options side by side in a pill-shaped track; a red indicator slides to the
     * active segment (transition like the Switch thumb). Replaces the Select dropdown for
     * small enums (e.g. `"none" | "left" | "right"` custom-button positions) — all options stay
     * visible, one click selects, spatial order mirrors the enum semantics.
     *
     * Each option is a `<button role="radio">` showing an optional single-path icon (via
     * `Icon.svelte`, `currentColor`) or its text label. `label` doubles as aria-label + title
     * tooltip (i18n). Options without `icon` render text-only segments.
     *
     * A11y: `role="radiogroup"` + per-segment `role="radio"` + `aria-checked`; ArrowLeft/ArrowRight
     * move the selection (cyclic), Home/End jump to first/last. Roving tabindex: the ACTIVE
     * segment is the tab stop, the container itself is not focusable (a focusable container
     * would create a double tab stop).
     *
     * `num`: store the selected value as a number (analogous to `Select.svelte`).
     * `disabled`: greys out + blocks input (group Super-Switch off).
     * `onChange`: optional side-effect callback after `store.setByPath` (analogous to Select/Switch).
     */
    import { store } from "../../stores/settings.svelte";
    import Icon from "./Icon.svelte";

    /** Option entry for the segmented control. `icon` = single SVG path (Feather-style). */
    export interface SegmentedOption {
        value: string;
        label: string;
        icon?: string;
    }

    let {
        path,
        options,
        num = false,
        disabled = false,
        ariaLabel,
        onChange,
    }: {
        path: string;
        options: SegmentedOption[];
        num?: boolean;
        disabled?: boolean;
        /** Accessible name for the radiogroup (also used as container title). */
        ariaLabel?: string;
        /** Optional side-effect callback (fires after setByPath, with the resolved value). */
        onChange?: (value: string | number) => void;
    } = $props();

    const currentValue = $derived(String(store.getByPath(path)));
    const activeIndex = $derived(options.findIndex((o) => o.value === currentValue));

    /**
     * Persists the selected option value to the store (num-aware) and fires onChange.
     */
    function select(option: SegmentedOption): void {
        const value = num ? Number(option.value) : option.value;
        store.setByPath(path, value);
        onChange?.(value);
    }

    /**
     * Keyboard navigation: cyclic prev/next via ArrowLeft/Right, Home/End for first/last.
     * No-op when the value is not among the options (activeIndex -1) or empty options.
     */
    function onKeyDown(e: KeyboardEvent): void {
        if (!options.length) return;
        let index = activeIndex;
        switch (e.key) {
            case "ArrowLeft":
                index = activeIndex <= 0 ? options.length - 1 : activeIndex - 1;
                break;
            case "ArrowRight":
                index = activeIndex === options.length - 1 ? 0 : activeIndex + 1;
                break;
            case "Home":
                index = 0;
                break;
            case "End":
                index = options.length - 1;
                break;
            default:
                return;
        }
        e.preventDefault();
        select(options[index]);
        // * Focus the newly active segment (aria-checked follows the store value).
        const buttons = (e.currentTarget as HTMLElement).querySelectorAll("button");
        buttons[index]?.focus();
    }
</script>

<div
    class="yt-tweaks-seg"
    class:yt-tweaks-seg-disabled={disabled}
    role="radiogroup"
    aria-label={ariaLabel}
    aria-disabled={disabled}
    data-active-index={activeIndex}
    tabindex="-1"
    style={`--seg-count:${options.length}`}
    onkeydown={onKeyDown}
>
    {#if activeIndex >= 0}<div class="yt-tweaks-seg-ind" style={`--seg-index:${activeIndex}`}></div>{/if}
    {#each options as option, index (option.value)}
        <button
            type="button"
            role="radio"
            aria-checked={activeIndex === index}
            title={option.label}
            tabindex={activeIndex === index && !disabled ? 0 : -1}
            {disabled}
            onclick={() => select(option)}
        >
            {#if option.icon}
                <Icon path={option.icon} size={14} strokeWidth="2.5" />
            {:else}
                <span class="yt-tweaks-seg-txt">{option.label}</span>
            {/if}
        </button>
    {/each}
</div>
