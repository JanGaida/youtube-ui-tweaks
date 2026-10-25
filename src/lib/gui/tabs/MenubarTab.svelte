<script lang="ts">
    /**
     * Menubar tab: 5 flat sections for the YouTube topbar (masthead) tweaks.
     *
     * Sections in spatial order (mirrors the masthead left → right): left side (hamburger),
     * search bar, right side (create/notifications), custom buttons (reorderable via DnD),
     * styling. Each section header carries the shared group Super-Switch
     * (`styling.masthead.enabled`) — toggling it on any section affects the whole group;
     * when off, all section bodies are greyed out + non-interactive (analogous to the Ads tab).
     *
     * The custom-buttons section renders the 8 button fields as DraggableRow components in
     * buttonOrder, each with a Segmented control (left/none/right) instead of a dropdown;
     * the styling section holds spacing/align/hover-presets.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Switch from "../components/Switch.svelte";
    import Select from "../components/Select.svelte";
    import Stepper from "../components/Stepper.svelte";
    import TextInput from "../components/TextInput.svelte";
    import Segmented from "../components/Segmented.svelte";
    import DraggableRow from "../components/DraggableRow.svelte";
    import { store } from "../../stores/settings.svelte";
    import { t } from "../i18n.svelte";

    // * Reactive group-enable flag → drives the disabled rendering of all section bodies.
    const mastheadEnabled = $derived(Boolean(store.getByPath("styling.masthead.enabled")));

    // * Button keys in the order of the settings default (reactively re-sorted via
    //   buttonOrder). Static reference for the field rendering.
    const BUTTON_KEYS = [
        "history",
        "subscriptions",
        "playlists",
        "watchLater",
        "likedVideos",
        "myVideos",
        "downloads",
        "settings",
    ] as const;

    // * i18n label keys per button (for the Field label inside the DraggableRow).
    const BUTTON_LABEL_KEYS: Record<string, string> = {
        history: "field.historyButton",
        subscriptions: "field.subscriptionsButton",
        playlists: "field.playlistsButton",
        watchLater: "field.watchLaterButton",
        likedVideos: "field.likedVideosButton",
        myVideos: "field.myVideosButton",
        downloads: "field.downloadsButton",
        settings: "field.settingsButton",
    };

    // * Current buttonOrder from the store (reactive).
    const buttonOrder = $derived<string[]>(
        (store.getByPath("styling.masthead.buttonOrder") as string[] | undefined) ?? [...BUTTON_KEYS],
    );

    /**
     * Reorder handler: moves draggedId before/after targetId in the buttonOrder array
     * and persists via store.setByPath.
     */
    function onReorder(draggedId: string, targetId: string, position: "before" | "after"): void {
        const current = [...buttonOrder];
        const draggedIdx = current.indexOf(draggedId);
        if (draggedIdx === -1) return;
        // * Remove first, then recompute the target index (the array got shorter).
        current.splice(draggedIdx, 1);
        let targetIdx = current.indexOf(targetId);
        if (targetIdx === -1) {
            // * Target not found (shouldn't happen) → append at the end.
            current.push(draggedId);
        } else {
            if (position === "after") targetIdx += 1;
            current.splice(targetIdx, 0, draggedId);
        }
        store.setByPath("styling.masthead.buttonOrder", current);
    }

    /**
     * Keyboard move handler (a11y): moves the row one slot in the buttonOrder array.
     */
    function onKeyboardMove(id: string, dir: -1 | 1): void {
        const current = [...buttonOrder];
        const idx = current.indexOf(id);
        if (idx === -1) return;
        const target = idx + dir;
        if (target < 0 || target >= current.length) return;
        current.splice(idx, 1);
        current.splice(target, 0, id);
        store.setByPath("styling.masthead.buttonOrder", current);
    }

    // * Segmented options for the button position (spatial order: left → off → right).
    // * $derived so the labels follow a live locale switch (a plain const would keep
    //   the old language until the panel is remounted).
    const positionOptions = $derived([
        { value: "left", label: t("opt.btnLeft"), icon: "M19 12H5M12 19l-7-7 7-7" },
        { value: "none", label: t("opt.btnNone"), icon: "M18 6L6 18M6 6l12 12" },
        { value: "right", label: t("opt.btnRight"), icon: "M5 12h14M12 5l7 7-7 7" },
    ]);

    // * Select options for notifications (default/always/empty).
    const notificationOptions = $derived([
        { value: "default", label: t("opt.notifDefault"), desc: t("optdesc.notifDefault") },
        { value: "always", label: t("opt.notifAlways"), desc: t("optdesc.notifAlways") },
        { value: "empty", label: t("opt.notifEmpty"), desc: t("optdesc.notifEmpty") },
    ]);

    // * Preset options for hover opacity + animation speed (verbose dropdown items).
    const opacityOptions = $derived([
        { value: "100", label: t("opt.opacity100"), desc: t("optdesc.opacity100") },
        { value: "75", label: t("opt.opacity75"), desc: t("optdesc.opacity75") },
        { value: "50", label: t("opt.opacity50"), desc: t("optdesc.opacity50") },
        { value: "25", label: t("opt.opacity25"), desc: t("optdesc.opacity25") },
        { value: "0", label: t("opt.opacity0"), desc: t("optdesc.opacity0") },
    ]);
    // * Includes the factory default 150ms — without a matching option the Select would
    //   display a wrong fallback label ("Instant") for a fresh install.
    const animSpeedOptions = $derived([
        { value: "0", label: t("opt.animInstant"), desc: t("optdesc.animInstant") },
        { value: "100", label: t("opt.anim100"), desc: t("optdesc.anim100") },
        { value: "150", label: t("opt.anim150"), desc: t("optdesc.anim150") },
        { value: "200", label: t("opt.anim200"), desc: t("optdesc.anim200") },
        { value: "400", label: t("opt.anim400"), desc: t("optdesc.anim400") },
    ]);
</script>

<!-- * 1. Left masthead area (hamburger icon) -->
<Section
    id="masthead-left"
    title={t("sec.masthead-left")}
    desc={t("sec.masthead-left.desc")}
    toggleKey="styling.masthead.enabled"
    disabled={!mastheadEnabled}
>
    <Field label={t("field.hideHamburger")}><Switch path="styling.masthead.hideHamburger" /></Field>
</Section>

<!-- * 2. Search bar -->
<Section
    id="masthead-search"
    title={t("sec.masthead-search")}
    desc={t("sec.masthead-search.desc")}
    toggleKey="styling.masthead.enabled"
    disabled={!mastheadEnabled}
>
    <Field label={t("field.searchWidth")}
        ><Stepper path="styling.masthead.searchWidthPct" min={20} max={80} unit="vw" /></Field
    >
    <Field label={t("field.hideSearchButton")}><Switch path="styling.masthead.hideSearchButton" /></Field>
    <Field label={t("field.hideMicButton")}><Switch path="styling.masthead.hideMicButton" /></Field>
</Section>

<!-- * 3. Right masthead area -->
<Section
    id="masthead-right"
    title={t("sec.masthead-right")}
    desc={t("sec.masthead-right.desc")}
    toggleKey="styling.masthead.enabled"
    disabled={!mastheadEnabled}
>
    <Field label={t("field.hideCreateButton")}><Switch path="styling.masthead.hideCreateButton" /></Field>
    <Field label={t("field.hideNotification")}
        ><Select path="styling.masthead.hideNotification" options={notificationOptions} /></Field
    >
</Section>

<!-- * 4. Custom buttons (Segmented, movable via drag) -->
<Section
    id="masthead-buttons"
    title={t("sec.masthead-buttons")}
    desc={t("sec.masthead-buttons.desc")}
    toggleKey="styling.masthead.enabled"
    disabled={!mastheadEnabled}
>
    {#each buttonOrder as key (key)}
        <DraggableRow
            id={key}
            label={t(BUTTON_LABEL_KEYS[key] as never)}
            {onReorder}
            {onKeyboardMove}
            disabled={!mastheadEnabled}
        >
            <Segmented path={`styling.masthead.${key}Button`} options={positionOptions} />
        </DraggableRow>
    {/each}
</Section>

<!-- * 5. Styling (spacing, alignment, hover effect) -->
<Section
    id="masthead-styling"
    title={t("sec.masthead-styling")}
    desc={t("sec.masthead-styling.desc")}
    toggleKey="styling.masthead.enabled"
    disabled={!mastheadEnabled}
>
    <!-- ! rem-validated: these values are interpolated into inline styles (masthead.ts). -->
    <Field label={t("field.logoSpacing")}><TextInput path="styling.masthead.logoSpacing" rem /></Field>
    <Field label={t("field.buttonSpacing")}><TextInput path="styling.masthead.buttonSpacing" rem /></Field>
    <Field label={t("field.rightSpacing")}><TextInput path="styling.masthead.rightSpacing" rem /></Field>
    <Field label={t("field.leftBarAlign")}
        ><Select
            path="styling.masthead.leftBarAlign"
            options={[
                { value: "logo", label: t("opt.barAlignLogo"), desc: t("optdesc.barAlignLogo") },
                { value: "center", label: t("opt.barAlignCenter"), desc: t("optdesc.barAlignCenter") },
                { value: "search", label: t("opt.barAlignSearchLeft"), desc: t("optdesc.barAlignSearchLeft") },
            ]}
        /></Field
    >
    <Field label={t("field.rightBarAlign")}
        ><Select
            path="styling.masthead.rightBarAlign"
            options={[
                { value: "buttons", label: t("opt.barAlignButtons"), desc: t("optdesc.barAlignButtons") },
                { value: "center", label: t("opt.barAlignCenter"), desc: t("optdesc.barAlignCenter") },
                { value: "search", label: t("opt.barAlignSearch"), desc: t("optdesc.barAlignSearch") },
            ]}
        /></Field
    >
    <Field label={t("field.toprowOpacityIdle")}
        ><Select path="styling.masthead.toprowOpacityIdle" options={opacityOptions} num /></Field
    >
    <Field label={t("field.toprowAnimSpeed")}
        ><Select path="styling.masthead.toprowAnimSpeed" options={animSpeedOptions} num /></Field
    >
</Section>
