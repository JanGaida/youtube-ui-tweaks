<script lang="ts">
    /**
     * Video-Item tab: 9 flat sections for video-card metadata tweaks.
     *
     * Sections are always visible (no collapse) — sub-navigation is via the CategorySidebar
     * section list + scroll-spy in App.svelte. Typography is preset-based (ADR 0006):
     * coupled font-size/line-height pairs instead of free-form rem inputs.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import TextInput from "../components/TextInput.svelte";
    import Select from "../components/Select.svelte";
    import Switch from "../components/Switch.svelte";
    import Subsection from "../components/Subsection.svelte";
    import { t } from "../i18n.svelte";
</script>

<Section id="styling" title={t("sec.styling")} desc={t("sec.styling.desc")} toggleKey="styling.enabled">
    <Field label={t("field.titleSize")}
        ><Select
            path="styling.titleSize"
            options={[
                { value: "xsmall", label: `${t("opt.xsmall")} (1.1/1.5rem)` },
                { value: "small", label: `${t("opt.small")} (1.2/1.65rem)` },
                { value: "medium", label: `${t("opt.medium")} (1.35/1.85rem)` },
                { value: "large", label: `${t("opt.large")} (1.5/2.05rem)` },
                { value: "xlarge", label: `${t("opt.xlarge")} (1.65/2.25rem)` },
            ]}
        /></Field
    >
    <Field label={t("field.titleMaxLines")}
        ><!-- ! No `num` — titleMaxLines is a STRING enum ("1".."4", "99" = all lines);
             a coerced Number("99") breaks the strict-equality check in grid-styling.ts. -->
        <Select
            path="styling.titleMaxLines"
            options={[
                { value: "1", label: t("opt.lines1"), desc: t("optdesc.lines1") },
                { value: "2", label: t("opt.lines2"), desc: t("optdesc.lines2") },
                { value: "3", label: t("opt.lines3"), desc: t("optdesc.lines3") },
                { value: "4", label: t("opt.lines4"), desc: t("optdesc.lines4") },
                { value: "99", label: t("opt.linesAll"), desc: t("optdesc.linesAll") },
            ]}
        /></Field
    >
    <Field label={t("field.titleAlign")}
        ><Select
            path="styling.titleAlign"
            options={[
                { value: "start", label: t("opt.alignStart"), desc: t("optdesc.alignStart") },
                { value: "center", label: t("opt.alignCenter"), desc: t("optdesc.alignCenter") },
                { value: "end", label: t("opt.alignEnd"), desc: t("optdesc.alignEnd") },
                { value: "justify", label: t("opt.alignJustify"), desc: t("optdesc.alignJustify") },
            ]}
        /></Field
    >
    <Field label={t("field.metaAlign")}
        ><Select
            path="styling.metaAlign"
            options={[
                { value: "left", label: t("opt.alignStart"), desc: t("optdesc.alignStart") },
                { value: "center", label: t("opt.alignCenter"), desc: t("optdesc.alignCenter") },
                { value: "right", label: t("opt.alignEnd"), desc: t("optdesc.alignEnd") },
                { value: "block", label: t("opt.alignBlock"), desc: t("optdesc.alignBlock") },
            ]}
        /></Field
    >
    <Field label={t("field.metaLayout")}
        ><Select
            path="styling.metaLayout"
            options={[
                { value: "mixed", label: t("opt.metaLayoutMixed"), desc: t("optdesc.metaLayoutMixed") },
                { value: "split", label: t("opt.metaLayoutSplit"), desc: t("optdesc.metaLayoutSplit") },
            ]}
        /></Field
    >
    <Field label={t("field.metaStatsGap")}
        ><Select
            path="styling.metaStatsGap"
            options={[
                { value: "tight", label: `${t("opt.spacingTight")} (8px)` },
                { value: "normal", label: `${t("opt.spacingNormal")} (16px)` },
                { value: "relaxed", label: `${t("opt.spacingRelaxed")} (24px)` },
            ]}
        /></Field
    >
    <Field label={t("field.metaSize")}
        ><Select
            path="styling.metaSize"
            options={[
                { value: "xsmall", label: `${t("opt.xsmall")} (1.0rem)` },
                { value: "small", label: `${t("opt.small")} (1.08rem)` },
                { value: "medium", label: `${t("opt.medium")} (1.15rem)` },
                { value: "large", label: `${t("opt.large")} (1.25rem)` },
                { value: "xlarge", label: `${t("opt.xlarge")} (1.35rem)` },
            ]}
        /></Field
    >
    <Field label={t("field.metaSpacing")}
        ><Select
            path="styling.metaSpacing"
            options={[
                { value: "tight", label: `${t("opt.spacingTight")} (0.35rem)` },
                { value: "normal", label: `${t("opt.spacingNormal")} (0.65rem)` },
                { value: "relaxed", label: `${t("opt.spacingRelaxed")} (0.95rem)` },
            ]}
        /></Field
    >
    <Field label={t("field.forceEqualHeight")}><Switch path="styling.forceEqualHeight" /></Field>
</Section>

<Section id="views" title={t("sec.views")} desc={t("sec.views.desc")} toggleKey="textShorten.shortenViews">
    <Field label={t("field.viewsWordMode")}
        ><Select
            path="textShorten.viewsWordMode"
            options={[
                { value: "none", label: t("opt.viewsWordNone"), desc: t("optdesc.viewsWordNone") },
                { value: "locale", label: t("opt.viewsWordLocale"), desc: t("optdesc.viewsWordLocale") },
            ]}
        /></Field
    >
    <Field label={t("field.viewsIcon")}><Switch path="textShorten.icons.viewsIcon" /></Field>
    <Field label={t("field.metaIconSize")}
        ><Select
            path="textShorten.icons.sizeEm"
            num
            options={[
                { value: "0.6", label: "0.6 em" },
                { value: "0.7", label: "0.7 em" },
                { value: "0.8", label: "0.8 em" },
                { value: "0.9", label: "0.9 em" },
                { value: "1", label: "1.0 em" },
                { value: "1.1", label: "1.1 em" },
                { value: "1.2", label: "1.2 em" },
                { value: "1.4", label: "1.4 em" },
            ]}
        /></Field
    >
    <Subsection title={t("subsec.number")}>
        <Field label={t("field.roundMode")}
            ><Select
                path="textShorten.views.roundMode"
                options={[
                    { value: "round", label: t("opt.round"), desc: t("optdesc.round") },
                    { value: "truncate", label: t("opt.truncate"), desc: t("optdesc.truncate") },
                ]}
            /></Field
        >
        <Field label={t("field.decimals")}
            ><Select
                path="textShorten.views.decimals"
                num
                options={[
                    { value: "0", label: "0 (1k)", desc: t("optdesc.decimals0") },
                    { value: "1", label: "1 (1.1k)", desc: t("optdesc.decimals1") },
                    { value: "2", label: "2 (1.05k)", desc: t("optdesc.decimals2") },
                ]}
            /></Field
        >
    </Subsection>
    <Subsection title={t("subsec.suffixes")}>
        <Field label={t("field.suffixK")}><TextInput path="textShorten.views.suffixes.k" /></Field>
        <Field label={t("field.suffixM")}><TextInput path="textShorten.views.suffixes.M" /></Field>
        <Field label={t("field.suffixB")}><TextInput path="textShorten.views.suffixes.B" /></Field>
        <Field label={t("field.suffixT")}><TextInput path="textShorten.views.suffixes.T" /></Field>
    </Subsection>
</Section>

<Section id="date" title={t("sec.date")} desc={t("sec.date.desc")} toggleKey="textShorten.shortenDate">
    <Field label={t("field.dateIcon")}><Switch path="textShorten.icons.dateIcon" /></Field>
    <Field label={t("field.years")}><TextInput path="textShorten.dateFormats.years" /></Field>
    <Field label={t("field.months")}><TextInput path="textShorten.dateFormats.months" /></Field>
    <Field label={t("field.weeks")}><TextInput path="textShorten.dateFormats.weeks" /></Field>
    <Field label={t("field.days")}><TextInput path="textShorten.dateFormats.days" /></Field>
    <Field label={t("field.hours")}><TextInput path="textShorten.dateFormats.hours" /></Field>
    <Field label={t("field.minutes")}><TextInput path="textShorten.dateFormats.minutes" /></Field>
</Section>

<Section id="avatar" title={t("sec.avatar")} desc={t("sec.avatar.desc")} toggleKey="styling.avatar.enabled">
    <Field label={t("field.hide")}><Switch path="styling.avatar.hide" /></Field>
    <Field label={t("field.size")}
        ><Select
            path="styling.avatar.size"
            options={[
                { value: "xsmall", label: `${t("opt.xsmall")} (20px)`, desc: t("optdesc.xsmall") },
                { value: "small", label: `${t("opt.small")} (28px)`, desc: t("optdesc.small") },
                { value: "medium", label: `${t("opt.medium")} (36px)`, desc: t("optdesc.medium") },
                { value: "large", label: `${t("opt.large")} (48px)`, desc: t("optdesc.large") },
                { value: "xlarge", label: `${t("opt.xlarge")} (64px)`, desc: t("optdesc.xlarge") },
            ]}
        /></Field
    >
    <!-- ! rem-validated: the value is interpolated into generated CSS (avatar margin). -->
    <Field label={t("field.marginRight")}><TextInput path="styling.avatar.margin" rem /></Field>
</Section>

<Section
    id="menu-icon"
    title={t("sec.menu-icon")}
    desc={t("sec.menu-icon.desc")}
    toggleKey="styling.menuButton.enabled"
>
    <Field label={t("field.hideMenuButton")}><Switch path="styling.menuButton.hide" /></Field>
    <Field label={t("field.size")}
        ><Select
            path="styling.menuButton.size"
            options={[
                { value: "xsmall", label: `${t("opt.xsmall")} (16px)`, desc: t("optdesc.xsmall") },
                { value: "small", label: `${t("opt.small")} (20px)`, desc: t("optdesc.small") },
                { value: "medium", label: `${t("opt.medium")} (24px)`, desc: t("optdesc.medium") },
                { value: "large", label: `${t("opt.large")} (32px)`, desc: t("optdesc.large") },
                { value: "xlarge", label: `${t("opt.xlarge")} (40px)`, desc: t("optdesc.xlarge") },
            ]}
        /></Field
    >
</Section>

<Section
    id="auto-sync-badge"
    title={t("sec.auto-sync-badge")}
    desc={t("sec.auto-sync-badge.desc")}
    toggleKey="autoSyncBadge.enabled"
>
    <Field label={t("field.badgeMode")}
        ><Select
            path="autoSyncBadge.mode"
            options={[
                { value: "original", label: t("opt.badgeOriginal"), desc: t("optdesc.badgeOriginal") },
                { value: "hidden", label: t("opt.badgeHidden"), desc: t("optdesc.badgeHidden") },
                {
                    value: "integrated-start",
                    label: t("opt.badgeIntegratedStart"),
                    desc: t("optdesc.badgeIntegratedStart"),
                },
                { value: "integrated-end", label: t("opt.badgeIntegratedEnd"), desc: t("optdesc.badgeIntegratedEnd") },
            ]}
        /></Field
    >
    <Field label={t("field.badgeIconSize")}
        ><Select
            path="autoSyncBadge.iconSizeEm"
            num
            options={[
                { value: "0.6", label: "0.6 em", desc: t("optdesc.em06") },
                { value: "0.7", label: "0.7 em", desc: t("optdesc.em07") },
                { value: "0.8", label: "0.8 em", desc: t("optdesc.em08") },
                { value: "0.9", label: "0.9 em", desc: t("optdesc.em09") },
                { value: "1", label: "1.0 em", desc: t("optdesc.em10") },
                { value: "1.1", label: "1.1 em", desc: t("optdesc.em11") },
                { value: "1.2", label: "1.2 em", desc: t("optdesc.em12") },
                { value: "1.4", label: "1.4 em", desc: t("optdesc.em14") },
            ]}
        /></Field
    >
    <Field label={t("field.badgeDivider")}><TextInput path="autoSyncBadge.divider" /></Field>
</Section>

<Section
    id="hide-elements"
    title={t("sec.hide-elements")}
    desc={t("sec.hide-elements.desc")}
    toggleKey="hideElements.enabled"
>
    <Field label={t("field.hideVerifiedBadge")}><Switch path="hideElements.hideVerifiedBadge" /></Field>
</Section>

<Section id="dim-watched" title={t("sec.dim-watched")} desc={t("sec.dim-watched.desc")} toggleKey="dimWatched.enabled">
    <Field label={t("field.brightness")}
        ><Select
            path="dimWatched.brightness"
            options={[
                { value: "subtle", label: t("opt.brightSubtle"), desc: t("optdesc.brightSubtle") },
                { value: "light", label: t("opt.brightLight"), desc: t("optdesc.brightLight") },
                { value: "medium", label: t("opt.brightMedium"), desc: t("optdesc.brightMedium") },
                { value: "strong", label: t("opt.brightStrong"), desc: t("optdesc.brightStrong") },
            ]}
        /></Field
    >
    <Field label={t("field.progressSteps")}
        ><Select
            path="dimWatched.progressSteps"
            options={[
                { value: "off", label: t("opt.dimStepsOff") },
                { value: "quarter", label: t("opt.dimStepsQuarter") },
                { value: "third", label: t("opt.dimStepsThird") },
                { value: "half", label: t("opt.dimStepsHalf") },
            ]}
        /></Field
    >
    <Field label={t("field.stepIntensity")}
        ><Select
            path="dimWatched.stepIntensity"
            options={[
                { value: "subtle", label: t("opt.stepIntSubtle") },
                { value: "medium", label: t("opt.stepIntMedium") },
                { value: "strong", label: t("opt.stepIntStrong") },
            ]}
        /></Field
    >
    <Field label={t("field.hoverReveal")}><Switch path="dimWatched.hoverReveal" /></Field>
</Section>

<Section
    id="preview-delay"
    title={t("sec.preview-delay")}
    desc={t("sec.preview-delay.desc")}
    toggleKey="previewDelay.enabled"
>
    <Field label={t("field.previewDelay")}
        ><Select
            path="previewDelay.delayMs"
            num
            options={[
                { value: "0", label: t("opt.delayOff"), desc: t("optdesc.delayOff") },
                { value: "500", label: t("opt.delay0_5s"), desc: t("optdesc.delay0_5s") },
                { value: "750", label: t("opt.delay0_75s"), desc: t("optdesc.delay0_75s") },
                { value: "1000", label: t("opt.delay1s"), desc: t("optdesc.delay1s") },
                { value: "1250", label: t("opt.delay1_25s"), desc: t("optdesc.delay1_25s") },
                { value: "1500", label: t("opt.delay1_5s"), desc: t("optdesc.delay1_5s") },
                { value: "2000", label: t("opt.delay2s"), desc: t("optdesc.delay2s") },
                { value: "3000", label: t("opt.delay3s"), desc: t("optdesc.delay3s") },
                { value: "5000", label: t("opt.delay5s"), desc: t("optdesc.delay5s") },
                { value: "8000", label: t("opt.delay8s"), desc: t("optdesc.delay8s") },
                { value: "10000", label: t("opt.delay10s"), desc: t("optdesc.delay10s") },
            ]}
        /></Field
    >
</Section>
