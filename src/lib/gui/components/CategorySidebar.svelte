<script lang="ts">
    /**
     * CategorySidebar: two-level vertical navigation.
     *
     * Level 1: 9 category buttons (always visible) — the active one is highlighted.
     * Level 2: section buttons of the *active* category (indented under it). Section
     * buttons carry the scroll-spy `.active` state as a hook only — NO visual highlight
     * (deliberately removed); clicking a section button smooth-scrolls the content to it.
     *
     * Replaces the old CategorySidebar + PillNav combo — sub-navigation lives in
     * the sidebar now (scales vertically, no horizontal overflow problem).
     */
    import type { CategoryDef, CategoryId } from "../navigation/categories";
    import Icon from "./Icon.svelte";
    import { CAT_ICONS } from "../icons";
    import { t } from "../i18n.svelte";

    let {
        categories,
        activeCategoryId,
        activeSectionId,
        onSelectCategory,
        onSelectSection,
    }: {
        categories: CategoryDef[];
        activeCategoryId: CategoryId;
        activeSectionId: string | null;
        onSelectCategory: (id: CategoryId) => void;
        onSelectSection: (id: string) => void;
    } = $props();
</script>

<div class="yt-tweaks-cat-list">
    {#each categories as cat (cat.id)}
        <button
            class="yt-tweaks-cat-btn"
            class:active={activeCategoryId === cat.id}
            data-cat={cat.id}
            onclick={() => onSelectCategory(cat.id)}
        >
            <span class="yt-tweaks-cat-icon"><Icon path={CAT_ICONS[cat.icon] ?? ""} size={16} /></span>
            <span class="yt-tweaks-cat-label">{t(cat.labelKey)}</span>
            {#if cat.sections.length > 1}
                <span class="yt-tweaks-cat-count">{cat.sections.length}</span>
            {/if}
        </button>
        {#if activeCategoryId === cat.id && cat.sections.length > 1}
            <div class="yt-tweaks-section-sublist">
                {#each cat.sections as sec (sec.id)}
                    <button
                        class="yt-tweaks-section-sub-btn"
                        class:active={activeSectionId === sec.id}
                        onclick={() => onSelectSection(sec.id)}
                    >
                        {t(sec.labelKey)}
                    </button>
                {/each}
            </div>
        {/if}
    {/each}
</div>
