<script lang="ts">
    /**
     * Watch-Page tab: metadata & action-button layout of the `/watch` page
     * (ytd-watch-metadata). One flat section with 7 controls — member-button hide,
     * like/dislike hide, share/save/download enum, description click-fold + line-count.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Switch from "../components/Switch.svelte";
    import Select from "../components/Select.svelte";
    import { t } from "../i18n.svelte";

    // * Action-button mode: standard (visible) | "verstecken" (completely hidden).
    //   ! The persisted enum value is the GERMAN word "verstecken" (legacy data-model value
    //   kept for settings-compat — an English-value migration would invalidate every
    //   existing export; matched in watch-page.ts, labeled via i18n here).
    // * $derived so the labels follow a live locale switch.
    const actionButtonOptions = $derived([
        { value: "standard", label: t("opt.actionStandard"), desc: t("optdesc.actionStandard") },
        { value: "verstecken", label: t("opt.actionHide"), desc: t("optdesc.actionHide") },
    ]);

    // * Description line count (collapsed snippet, 2rem per line).
    const descLinesOptions = $derived([
        { value: "2", label: t("opt.descLines2"), desc: t("optdesc.descLines2") },
        { value: "3", label: t("opt.descLines3"), desc: t("optdesc.descLines3") },
        { value: "4", label: t("opt.descLines4"), desc: t("optdesc.descLines4") },
        { value: "5", label: t("opt.descLines5"), desc: t("optdesc.descLines5") },
    ]);
</script>

<Section
    id="watch-layout"
    title={t("sec.watch-layout")}
    desc={t("sec.watch-layout.desc")}
    toggleKey="watchPage.enabled"
>
    <Field label={t("field.hideMemberButton")}><Switch path="watchPage.hideMemberButton" /></Field>
    <Field label={t("field.hideLikeDislike")}><Switch path="watchPage.hideLikeDislike" /></Field>
    <Field label={t("field.shareButton")}><Select path="watchPage.shareButton" options={actionButtonOptions} /></Field>
    <Field label={t("field.saveButton")}><Select path="watchPage.saveButton" options={actionButtonOptions} /></Field>
    <Field label={t("field.downloadButton")}
        ><Select path="watchPage.downloadButton" options={actionButtonOptions} /></Field
    >
    <Field label={t("field.descriptionClickFold")}><Switch path="watchPage.descriptionClickFold" /></Field>
    <Field label={t("field.descriptionLines")}
        ><Select path="watchPage.descriptionLines" options={descLinesOptions} /></Field
    >
</Section>
