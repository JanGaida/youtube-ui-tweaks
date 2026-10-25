<script lang="ts">
    /**
     * Guide-Sidebar tab: sections for the YouTube left sidebar pane (guide/mini-guide).
     *
     * Flat sections (no nested boxes): behavior, expanded sidebar, collapsed sidebar,
     * group order (drag to reorder groups), 6 group boxes (per-group hide + entry sort),
     * show-more (global expander control).
     * Strictly separated from the Masthead category — this tab owns only the sidebar pane.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Switch from "../components/Switch.svelte";
    import Select from "../components/Select.svelte";
    import DraggableRow from "../components/DraggableRow.svelte";
    import { store } from "../../stores/settings.svelte";
    import { t } from "../i18n.svelte";
    import { GUIDE_ENTRY_KEYS } from "../../core/features/guide-entries";
    import { GUIDE_GROUPS, DEFAULT_GROUP_ORDER, getGroupDef } from "../../core/features/guide-groups";

    // * i18n label keys per guide entry.
    const ENTRY_LABEL_KEYS: Record<string, string> = {
        home: "field.guideEntry.home",
        shorts: "field.guideEntry.shorts",
        subscriptions: "field.guideEntry.subscriptions",
        myYouTube: "field.guideEntry.myYouTube",
        myChannel: "field.guideEntry.myChannel",
        history: "field.guideEntry.history",
        playlists: "field.guideEntry.playlists",
        watchLater: "field.guideEntry.watchLater",
        likedVideos: "field.guideEntry.likedVideos",
        myVideos: "field.guideEntry.myVideos",
        downloads: "field.guideEntry.downloads",
        ytPremium: "field.guideEntry.ytPremium",
        ytMusic: "field.guideEntry.ytMusic",
        ytKids: "field.guideEntry.ytKids",
        music: "field.guideEntry.music",
        moviesShows: "field.guideEntry.moviesShows",
        live: "field.guideEntry.live",
        reportHistory: "field.guideEntry.reportHistory",
    };

    // * Entry toggles are inverted: ON = show, OFF = hide.
    const ENTRY_TOGGLE_INVERTED = true;

    // * Reactive group order (default = DEFAULT_GROUP_ORDER when the array is empty).
    const groupOrder = $derived<string[]>(
        (store.getByPath("guide.entries.groups.order") as string[] | undefined)?.length
            ? (store.getByPath("guide.entries.groups.order") as string[])
            : [...DEFAULT_GROUP_ORDER],
    );

    // * Reactive entry order.
    const entryOrder = $derived<string[]>(
        (store.getByPath("guide.entries.order") as string[] | undefined)?.length
            ? (store.getByPath("guide.entries.order") as string[])
            : [...GUIDE_ENTRY_KEYS],
    );

    /**
     * Reorder handler for the group order.
     */
    function onGroupReorder(draggedId: string, targetId: string, position: "before" | "after"): void {
        const current = [...groupOrder];
        const draggedIdx = current.indexOf(draggedId);
        if (draggedIdx === -1) return;
        current.splice(draggedIdx, 1);
        let targetIdx = current.indexOf(targetId);
        if (targetIdx === -1) {
            current.push(draggedId);
        } else {
            if (position === "after") targetIdx += 1;
            current.splice(targetIdx, 0, draggedId);
        }
        store.setByPath("guide.entries.groups.order", current);
    }

    /**
     * Keyboard move handler (a11y): moves a GROUP row one slot in the group order.
     */
    function onGroupKeyboardMove(id: string, dir: -1 | 1): void {
        const current = [...groupOrder];
        const idx = current.indexOf(id);
        if (idx === -1) return;
        const target = idx + dir;
        if (target < 0 || target >= current.length) return;
        current.splice(idx, 1);
        current.splice(target, 0, id);
        store.setByPath("guide.entries.groups.order", current);
    }

    /**
     * Reorder handler for entries within a group.
     */
    function onEntryReorder(draggedId: string, targetId: string, position: "before" | "after"): void {
        const current = [...entryOrder];
        const draggedIdx = current.indexOf(draggedId);
        if (draggedIdx === -1) return;
        current.splice(draggedIdx, 1);
        let targetIdx = current.indexOf(targetId);
        if (targetIdx === -1) {
            current.push(draggedId);
        } else {
            if (position === "after") targetIdx += 1;
            current.splice(targetIdx, 0, draggedId);
        }
        store.setByPath("guide.entries.order", current);
    }

    /**
     * Keyboard move handler (a11y): moves an ENTRY row one slot in the entry order.
     */
    function onEntryKeyboardMove(id: string, dir: -1 | 1): void {
        const current = [...entryOrder];
        const idx = current.indexOf(id);
        if (idx === -1) return;
        const target = idx + dir;
        if (target < 0 || target >= current.length) return;
        current.splice(idx, 1);
        current.splice(target, 0, id);
        store.setByPath("guide.entries.order", current);
    }

    /**
     * Checks whether a group is hidden (→ its children render disabled).
     */
    function isGroupHidden(gid: string): boolean {
        return Boolean(store.getByPath(`guide.entries.groups.hidden.${gid}`));
    }

    // * Select options for the guide visibility.
    // * $derived so the labels follow a live locale switch.
    const visibilityOptions = $derived([
        { value: "default", label: t("opt.guideDefault"), desc: t("optdesc.guideDefault") },
        { value: "hide-override", label: t("opt.guideHideOverride"), desc: t("optdesc.guideHideOverride") },
        { value: "hide-forced", label: t("opt.guideHideForced"), desc: t("optdesc.guideHideForced") },
    ]);

    // * Select options for the guide width.
    const widthOptions = $derived([
        { value: "compact", label: t("opt.guideWidthCompact"), desc: t("optdesc.guideWidthCompact") },
        { value: "default", label: t("opt.guideWidthDefault"), desc: t("optdesc.guideWidthDefault") },
        { value: "large", label: t("opt.guideWidthLarge"), desc: t("optdesc.guideWidthLarge") },
    ]);
</script>

<!-- * 1. Behavior (visibility) -->
<Section id="guide-verhalten" title={t("sec.guide-verhalten")} desc={t("sec.guide-verhalten.desc")}>
    <Field label={t("field.guideVisibility")}><Select path="guide.visibility" options={visibilityOptions} /></Field>
</Section>

<!-- * 2. Expanded sidebar (width + icon) -->
<Section id="guide-ausgeklappt" title={t("sec.guide-ausgeklappt")} desc={t("sec.guide-ausgeklappt.desc")}>
    <Field label={t("field.guideWidth")}><Select path="guide.width" options={widthOptions} /></Field>
    <Field label={t("field.guideShowIcon")}><Switch path="guide.showIcon" /></Field>
    <Field label={t("field.guideShowFooter")}><Switch path="guide.showFooter" /></Field>
</Section>

<!-- * 3. Collapsed sidebar (mini mode: hide text) -->
<Section id="guide-eingeklappt" title={t("sec.guide-eingeklappt")} desc={t("sec.guide-eingeklappt.desc")}>
    <Field label={t("field.guideMiniText")}><Switch path="guide.miniText" /></Field>
</Section>

<!-- * 4. Group order (drag-and-drop + toggle per group) -->
<Section id="guide-group-order" title={t("sec.guide-group-order")} desc={t("sec.guide-group-order.desc")}>
    {#each groupOrder as gid (gid)}
        {@const def = getGroupDef(gid)}
        {#if def}
            <DraggableRow
                id={gid}
                label={t(def.labelKey as never)}
                dragType="group"
                onReorder={onGroupReorder}
                onKeyboardMove={onGroupKeyboardMove}
            >
                <Switch path={`guide.entries.groups.hidden.${gid}`} inverted />
            </DraggableRow>
        {/if}
    {/each}
</Section>

<!-- * 5-10. Group boxes (per group: child entries in saved order, draggable) -->
{#each groupOrder as gid (gid)}
    {@const def = getGroupDef(gid)}
    {#if def}
        {@const groupHidden = isGroupHidden(gid)}
        {@const orderedEntryKeys = def.entryKeys.slice().sort((a, b) => {
            const ia = entryOrder.indexOf(a);
            const ib = entryOrder.indexOf(b);
            // * Keys not captured in order (indexOf=-1) count as MAX → stable at the end.
            return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
        })}
        <!-- ! Group-box descriptions use the `.desc` suffix key — without it the section
             shows the TITLE text twice (labelKey and desc would resolve to the same key). -->
        <Section
            id={`guide-group-${gid}`}
            title={t(def.labelKey as never)}
            desc={t(`sec.guide-group-${gid}.desc` as never)}
        >
            {#each orderedEntryKeys as entryId (entryId)}
                <DraggableRow
                    id={entryId}
                    label={t(ENTRY_LABEL_KEYS[entryId] as never)}
                    onReorder={onEntryReorder}
                    onKeyboardMove={onEntryKeyboardMove}
                    disabled={groupHidden}
                >
                    <Switch
                        path={`guide.entries.hidden.${entryId}`}
                        inverted={ENTRY_TOGGLE_INVERTED}
                        disabled={groupHidden}
                    />
                </DraggableRow>
            {/each}
        </Section>
    {/if}
{/each}

<!-- * 11. Show more (global expander control) -->
<Section id="guide-showmore" title={t("sec.guide-showmore")} desc={t("sec.guide-showmore.desc")}>
    <Field label={t("field.guideShowMoreButton")}><Switch path="guide.showMoreButton" /></Field>
    <Field label={t("field.guideShowMoreDefault")}><Switch path="guide.showMoreDefault" /></Field>
</Section>
