<script lang="ts">
    /**
     * Startpage tab: grid column-count override for the homepage (home) and the other
     * grid pages (subscriptions, channel).
     *
     * One section with a dropdown (preset: Standard (dynamic) / 1–10 / custom) and a
     * number-input field below (effective only when "custom" is selected).
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Select from "../components/Select.svelte";
    import { store } from "../../stores/settings.svelte";
    import { validation } from "../../stores/validation.svelte";
    import { t } from "../i18n.svelte";

    // * Preset options for the column count: YT-native + numbers 1–10 (label "N columns",
    //   desc = resolution context without repeating the number) + custom.
    //   Keys enumerated explicitly (no dynamic key builds).
    //   note 1: Label with unit — the trigger shows "6 columns" instead of a bare "6".
    //   note 2: "1 column" singular vs "N columns" plural — both keys exist.
    // * $derived so the labels follow a live locale switch.
    const presetOptions = $derived([
        { value: "default", label: t("opt.gridDefault"), desc: t("optdesc.gridDefault") },
        { value: "1", label: t("opt.gridOneColumn"), desc: t("optdesc.gridCols1") },
        { value: "2", label: t("opt.gridTwoColumns"), desc: t("optdesc.gridCols2") },
        { value: "3", label: t("opt.gridColumns", { n: 3 }), desc: t("optdesc.gridCols3") },
        { value: "4", label: t("opt.gridColumns", { n: 4 }), desc: t("optdesc.gridCols4") },
        { value: "5", label: t("opt.gridColumns", { n: 5 }), desc: t("optdesc.gridCols5") },
        { value: "6", label: t("opt.gridColumns", { n: 6 }), desc: t("optdesc.gridCols6") },
        { value: "7", label: t("opt.gridColumns", { n: 7 }), desc: t("optdesc.gridCols7") },
        { value: "8", label: t("opt.gridColumns", { n: 8 }), desc: t("optdesc.gridCols8") },
        { value: "9", label: t("opt.gridColumns", { n: 9 }), desc: t("optdesc.gridCols9") },
        { value: "10", label: t("opt.gridColumns", { n: 10 }), desc: t("optdesc.gridCols10") },
        { value: "custom", label: t("opt.gridCustom"), desc: t("optdesc.gridCustom") },
    ]);

    // * Reactive value: only relevant with the "custom" preset.
    const currentPreset = $derived(String(store.getByPath("startpage.columnsPreset")));
    const customValue = $derived(Number(store.getByPath("startpage.customColumns")) || 0);
    const isCustom = $derived(currentPreset === "custom");

    // * Validation error for customColumns (only relevant with custom).
    const customError = $derived(validation.getError("startpage.customColumns"));

    /**
     * Number-input handler: clamps the input to [1, 10] before writing to the store —
     * the feature CSS clamps visually, but the persisted setting must be sane too.
     */
    function onCustomInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        const v = Number(input.value);
        if (Number.isNaN(v)) return;
        store.setByPath("startpage.customColumns", Math.max(1, Math.min(10, v)));
    }
</script>

<Section
    id="startpage-grid"
    title={t("sec.startpage-grid")}
    desc={t("sec.startpage-grid.desc")}
    toggleKey="startpage.enabled"
>
    <Field label={t("field.gridColumnsPreset")}><Select path="startpage.columnsPreset" options={presetOptions} /></Field
    >
    <Field label={t("field.gridCustomColumns")}>
        <input
            class="yt-tweaks-number"
            class:invalid={isCustom && customError}
            type="number"
            min="1"
            max="10"
            step="1"
            value={customValue}
            disabled={!isCustom}
            title={customError?.message ?? ""}
            oninput={onCustomInput}
        />
    </Field>
</Section>
