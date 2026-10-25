<script lang="ts">
    /** Field: a labeled row wrapping a control (rendered via the children snippet).
     *
     * `disabled`: when true, the row is greyed out + non-interactive (opacity + pointer-events
     * none on the wrapper). Used by the Ads tab to disable a group's Fields when its Super-Switch
     * is off. The control itself does not need per-component `disabled` wiring — the wrapper class
     * blocks all input uniformly.
     *
     * `desc`: optional small explanation rendered under the label (e.g. gotchas like the
     * verified-badge slot co-hide). Keep short — one sentence.
     */
    import type { Snippet } from "svelte";

    let {
        label,
        desc = "",
        disabled = false,
        children,
    }: { label: string; desc?: string; disabled?: boolean; children?: Snippet } = $props();
</script>

<div class="yt-tweaks-field" class:yt-tweaks-field-disabled={disabled}>
    <span class="yt-tweaks-field-label">
        {label}
        {#if desc}<span class="yt-tweaks-field-desc">{desc}</span>{/if}
    </span>
    {@render children?.()}
</div>
