<script lang="ts">
    /**
     * Section: a flat titled region (no collapse) — replaces the old Group/Accordion.
     *
     * The `id` becomes the `data-section` anchor for the CategorySidebar section list + scroll-spy.
     * Unlike the old Group, the body is always visible (no toggle, no single-open
     * policy). An optional enable switch is rendered inline in the header when
     * `toggleKey` is set (e.g. `styling.enabled`), so feature-enable toggles stay
     * visible without the old collapsed-header affordance. The switch renders bare
     * (track+thumb only, no caption).
     *
     * `disabled`: when true, the section body (its Fields) is greyed out + non-interactive
     * (the caller drives this reactively from the group's enable flag, e.g. the Ads tab
     * disables a group's Fields when its Super-Switch is off). The header toggle itself
     * stays clickable so the group can be re-enabled.
     */
    import type { Snippet } from "svelte";
    import Switch from "./Switch.svelte";

    let {
        id,
        title,
        desc,
        toggleKey,
        disabled = false,
        children,
    }: {
        id: string;
        title: string;
        desc?: string;
        toggleKey?: string;
        disabled?: boolean;
        children?: Snippet;
    } = $props();
</script>

<section class="yt-tweaks-section" data-section={id}>
    <div class="yt-tweaks-section-head">
        <div class="yt-tweaks-section-headtext">
            <h3 class="yt-tweaks-section-title">{title}</h3>
            {#if desc}<p class="yt-tweaks-section-desc">{desc}</p>{/if}
        </div>
        {#if toggleKey}<Switch path={toggleKey} />{/if}
    </div>
    <div class="yt-tweaks-section-body" class:yt-tweaks-section-disabled={disabled}>
        {@render children?.()}
    </div>
</section>
