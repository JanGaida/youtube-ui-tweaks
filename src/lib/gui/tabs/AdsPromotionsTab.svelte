<script lang="ts">
    /**
     * Ads & Promotions tab: three gated groups, each with a Super-Switch in its Section header.
     *
     * Groups (mirrors the nested AdsSettings shape):
     *  - Promo & Ads      (ads.promo.enabled)  — Premium banner, big-screen, member-only.
     *  - Shelves          (ads.shelves.enabled) — discover shelf, shorts shelf, gaming shelves.
     *  - Survey           (ads.survey.enabled)  — inline star-rating survey.
     *
     * Each Section renders a bare Super-Switch (no caption — see Section.svelte) + its Fields.
     * When a group's Super-Switch is OFF, the Section body (its Fields) is greyed out +
     * non-interactive via the `disabled` prop (the header toggle stays clickable so the group
     * can be re-enabled). The feature itself additionally gates CSS/run on the group `enabled`
     * flag, so a disabled group emits no rules and runs no DOM pass.
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Switch from "../components/Switch.svelte";
    import { store } from "../../stores/settings.svelte";
    import { t } from "../i18n.svelte";

    // * Reactive group enable flags → drive the disabled rendering of the Section bodies.
    const promoEnabled = $derived(Boolean(store.getByPath("ads.promo.enabled")));
    const shelvesEnabled = $derived(Boolean(store.getByPath("ads.shelves.enabled")));
    const surveyEnabled = $derived(Boolean(store.getByPath("ads.survey.enabled")));
</script>

<Section
    id="promo-hide"
    title={t("sec.promo-hide")}
    desc={t("sec.promo-hide.desc")}
    toggleKey="ads.promo.enabled"
    disabled={!promoEnabled}
>
    <Field label={t("ads.promo.hidePremiumBanner")} disabled={!promoEnabled}
        ><Switch path="ads.promo.hidePremiumBanner" /></Field
    >
    <Field label={t("ads.promo.hideBigScreenAds")} disabled={!promoEnabled}
        ><Switch path="ads.promo.hideBigScreenAds" /></Field
    >
    <Field label={t("ads.promo.hideMemberOnly")} disabled={!promoEnabled}
        ><Switch path="ads.promo.hideMemberOnly" /></Field
    >
</Section>

<Section
    id="shelves"
    title={t("sec.shelves")}
    desc={t("sec.shelves.desc")}
    toggleKey="ads.shelves.enabled"
    disabled={!shelvesEnabled}
>
    <Field label={t("ads.shelves.hideDiscoverSection")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hideDiscoverSection" /></Field
    >
    <Field label={t("ads.shelves.hideShortsShelf")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hideShortsShelf" /></Field
    >
    <Field label={t("ads.shelves.hideGameShelves")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hideGameShelves" /></Field
    >
    <Field label={t("ads.shelves.hideDynamicGameShelves")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hideDynamicGameShelves" /></Field
    >
    <Field label={t("ads.shelves.hidePlayablesShelf")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hidePlayablesShelf" /></Field
    >
    <Field label={t("ads.shelves.hideContinueWatchingShelf")} disabled={!shelvesEnabled}
        ><Switch path="ads.shelves.hideContinueWatchingShelf" /></Field
    >
</Section>

<Section
    id="survey"
    title={t("sec.survey")}
    desc={t("sec.survey.desc")}
    toggleKey="ads.survey.enabled"
    disabled={!surveyEnabled}
>
    <Field label={t("ads.survey.hideInlineSurvey")} disabled={!surveyEnabled}
        ><Switch path="ads.survey.hideInlineSurvey" /></Field
    >
</Section>
