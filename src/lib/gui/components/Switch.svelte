<script lang="ts">
    /** Switch: a toggle (track + thumb + hidden checkbox) bound to a boolean store dot-path.
     *
     * `inverted`: when true, the toggle's visual+logic is inverted — toggle ON = stored value
     * `false` (used for "negative" settings like `guide.entries.hidden.<key>` where ON should mean
     * "show", not "hide"). Default false (normal semantics).
     *
     * `onChange`: optional side-effect callback (fires after `store.setByPath`, with the resolved
     * boolean value — the actual stored value, inverted-aware). Analogous to `Select.svelte`.
     * Useful for immediate effects the debounced live-apply wouldn't trigger (e.g. toggling the
     * global kill-switch needs `stopObserver` + DOM restore, not just CSS re-injection).
     *
     * A11y: the hidden checkbox carries an accessible name — `ariaLabel` when given, otherwise
     * the settings path (unique + stable; the visible Field label lives outside this component).
     */
    import { store } from "../../stores/settings.svelte";

    let {
        path,
        inverted = false,
        disabled = false,
        ariaLabel,
        onChange,
    }: {
        path: string;
        inverted?: boolean;
        disabled?: boolean;
        ariaLabel?: string;
        onChange?: (value: boolean) => void;
    } = $props();

    const checked = $derived(inverted ? !Boolean(store.getByPath(path)) : Boolean(store.getByPath(path)));

    function onChangeInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        const value = inverted ? !input.checked : input.checked;
        store.setByPath(path, value);
        onChange?.(value);
    }
</script>

<label class="yt-tweaks-switch-row">
    <span class="yt-tweaks-switch-track">
        <input
            type="checkbox"
            class="yt-tweaks-switch-input"
            aria-label={ariaLabel ?? path}
            {checked}
            {disabled}
            onchange={onChangeInput}
        />
        <span class="yt-tweaks-switch-thumb" aria-hidden="true">{checked ? "I" : "O"}</span>
    </span>
</label>
