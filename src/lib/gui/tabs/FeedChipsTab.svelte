<script lang="ts">
    /**
     * Filter-Chips tab: color override for the two YouTube filter-chip bars.
     *
     * Two sections — one per chip bar:
     *  - Start-Chips (homepage filter chips): `feedChips.enabled` toggle + two color pairs.
     *  - Wiedergabe-Seiten-Chips (watch-page related-video sidebar chips): `watchChips.enabled`
     *    toggle + two color pairs. Independent settings from the home chips.
     *
     * Each color pair is an enum (presets + "custom") with a conditional custom-hex text field
     * that appears only when the enum is set to "custom". The hex fields are validated by the
     * respective feature validators (regex on #rgb/#rrggbb/#rrggbbaa); invalid values drive the
     * `invalid` class + tooltip via TextInput.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Select from "../components/Select.svelte";
    import TextInput from "../components/TextInput.svelte";
    import { store } from "../../stores/settings.svelte";
    import { t } from "../i18n.svelte";

    // * Select options for both color enums (presets + "default" + "custom") — shared by
    //   both chip bars (the same color model applies).
    // * $derived so the labels follow a live locale switch.
    const colorOptions = $derived([
        { value: "default", label: t("opt.chipColorDefault"), desc: t("optdesc.chipColorDefault") },
        { value: "red", label: t("opt.chipColorRed"), desc: t("optdesc.chipColorRed") },
        { value: "blue", label: t("opt.chipColorBlue"), desc: t("optdesc.chipColorBlue") },
        { value: "green", label: t("opt.chipColorGreen"), desc: t("optdesc.chipColorGreen") },
        { value: "purple", label: t("opt.chipColorPurple"), desc: t("optdesc.chipColorPurple") },
        { value: "orange", label: t("opt.chipColorOrange"), desc: t("optdesc.chipColorOrange") },
        { value: "custom", label: t("opt.chipColorCustom"), desc: t("optdesc.chipColorCustom") },
    ]);

    // * Home-chips layout options: carousel + hide only (no stack — the home chip bar is a
    //   0-height overlay; wrapped chips would overlap the grid and CSS cannot push the grid
    //   below them, verified via live probe 2026-08-28).
    const homeLayoutOptions = $derived([
        { value: "collapse", label: t("opt.chipLayoutCollapse"), desc: t("optdesc.chipLayoutCollapse") },
        { value: "hide", label: t("opt.chipLayoutHide"), desc: t("optdesc.chipLayoutHide") },
    ]);

    // * Watch-chips layout options: carousel + list + hide (all supported — the watch chip
    //   bar is a regular block, not an overlay).
    const watchLayoutOptions = $derived([
        { value: "collapse", label: t("opt.chipLayoutCollapse"), desc: t("optdesc.chipLayoutCollapse") },
        { value: "stack", label: t("opt.chipLayoutStack"), desc: t("optdesc.chipLayoutStack") },
        { value: "hide", label: t("opt.chipLayoutHide"), desc: t("optdesc.chipLayoutHide") },
    ]);

    // * Reactive mode values (home chips) → control whether the respective hex field renders.
    const activeMode = $derived(String(store.getByPath("feedChips.activeColor") ?? "default"));
    const inactiveMode = $derived(String(store.getByPath("feedChips.inactiveColor") ?? "default"));
    const isActiveCustom = $derived(activeMode === "custom");
    const isInactiveCustom = $derived(inactiveMode === "custom");

    // * Reactive mode values (watch chips) — analogous to the home chips.
    const watchActiveMode = $derived(String(store.getByPath("watchChips.activeColor") ?? "default"));
    const watchInactiveMode = $derived(String(store.getByPath("watchChips.inactiveColor") ?? "default"));
    const isWatchActiveCustom = $derived(watchActiveMode === "custom");
    const isWatchInactiveCustom = $derived(watchInactiveMode === "custom");
</script>

<!-- * Home chips — color + layout for the filter chips (toggle in the section header) -->
<Section
    id="chips-verhalten"
    title={t("sec.chips-verhalten")}
    desc={t("sec.chips-verhalten.desc")}
    toggleKey="feedChips.enabled"
>
    <Field label={t("field.chipsLayout")}><Select path="feedChips.layout" options={homeLayoutOptions} /></Field>

    <Field label={t("field.chipsActiveColor")}><Select path="feedChips.activeColor" options={colorOptions} /></Field>
    {#if isActiveCustom}
        <Field label={t("field.chipsActiveColorHex")}><TextInput path="feedChips.activeColorHex" /></Field>
    {/if}

    <Field label={t("field.chipsInactiveColor")}><Select path="feedChips.inactiveColor" options={colorOptions} /></Field
    >
    {#if isInactiveCustom}
        <Field label={t("field.chipsInactiveColorHex")}><TextInput path="feedChips.inactiveColorHex" /></Field>
    {/if}
</Section>

<!-- * Watch-page chips — color + layout for the watch-page sidebar chips -->
<Section id="chips-watch" title={t("sec.chips-watch")} desc={t("sec.chips-watch.desc")} toggleKey="watchChips.enabled">
    <Field label={t("field.chipsWatchLayout")}><Select path="watchChips.layout" options={watchLayoutOptions} /></Field>

    <Field label={t("field.chipsWatchActiveColor")}
        ><Select path="watchChips.activeColor" options={colorOptions} /></Field
    >
    {#if isWatchActiveCustom}
        <Field label={t("field.chipsWatchActiveColorHex")}><TextInput path="watchChips.activeColorHex" /></Field>
    {/if}

    <Field label={t("field.chipsWatchInactiveColor")}
        ><Select path="watchChips.inactiveColor" options={colorOptions} /></Field
    >
    {#if isWatchInactiveCustom}
        <Field label={t("field.chipsWatchInactiveColorHex")}><TextInput path="watchChips.inactiveColorHex" /></Field>
    {/if}
</Section>
