<script lang="ts">
    /**
     * System tab: 4 flat sections — toggles, panel config, logging verbosity, and live status.
     *
     * Replaces the old GeneralTab (which mixed interface + diagnostics under accordions).
     * Receives live DebugStats from App.svelte as a prop (same as the old GeneralTab).
     */
    import Section from "../components/Section.svelte";
    import Field from "../components/Field.svelte";
    import Select from "../components/Select.svelte";
    import Stepper from "../components/Stepper.svelte";
    import Switch from "../components/Switch.svelte";
    import log, { setLogLevel, LOG_LEVEL_LABELS, getRecentLogs, getLogLevel, SCOPES } from "../../core/log";
    import { detectLocale } from "../../core/locale";
    import { getPageCtx } from "../../core/page";
    import { setTweaksEnabled } from "../../core/system-toggle";
    import { setAnonymize, applyAnonymize } from "../../core/anonymize";
    import { t, getLocaleOptions } from "../i18n.svelte";
    import { store } from "../../stores/settings.svelte";
    import type { DebugStats } from "../types";

    // * Props from App.svelte: live stats (refreshed periodically).
    let { stats }: { stats: DebugStats } = $props();

    // * Log-level options from LOG_LEVEL_LABELS (bound reactively via Select.svelte).
    // * desc keys mapped per level label (optdesc.logDebug/logInfo/logWarn/logError/logSilent).
    const LOG_DESC_KEYS: Record<
        string,
        "optdesc.logDebug" | "optdesc.logInfo" | "optdesc.logWarn" | "optdesc.logError" | "optdesc.logSilent"
    > = {
        debug: "optdesc.logDebug",
        info: "optdesc.logInfo",
        warn: "optdesc.logWarn",
        error: "optdesc.logError",
        silent: "optdesc.logSilent",
    };
    // * $derived so the descriptions follow a live locale switch.
    const logLevelOptions = $derived(
        LOG_LEVEL_LABELS.map((label) => ({ value: label, label, desc: t(LOG_DESC_KEYS[label]) })),
    );

    // * Side effect: apply the level immediately (no debounce). Called after setByPath.
    function onLogLevelChange(value: string | number): void {
        setLogLevel(String(value));
    }

    // * Re-apply the anonymize layer when the blur strength changes (Stepper mutates the store
    //   directly via setByPath — no onChange callback like Switch). Only re-apply when the
    //   layer is currently enabled (no point mounting it just to update blur).
    // * Reads blur purely as an effect dependency (its value is not used directly) —
    //   applyAnonymize(true) reads the current blur from the settings itself.
    $effect(() => {
        store.getByPath("system.anonymizeBlur");
        if (store.getByPath("system.anonymize")) {
            applyAnonymize(true);
        }
    });

    // * Debug report — sanitized: log records + meta only, no settings and no page text.
    let copyStatus = $state<"" | "ok" | "error" | "empty">("");
    let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

    function setCopyStatus(status: typeof copyStatus): void {
        copyStatus = status;
        if (copyResetTimer) clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
            copyStatus = "";
            copyResetTimer = null;
        }, 2500);
    }

    async function onCopyDebugReport(): Promise<void> {
        const records = getRecentLogs();
        if (records.length === 0) {
            setCopyStatus("empty");
            return;
        }
        let page = "unknown";
        try {
            page = getPageCtx().page;
        } catch {
            // * PageContext not initialized yet — keep the report usable.
        }
        const report = {
            meta: {
                generatedAt: new Date().toISOString(),
                scriptVersion: typeof GM_info !== "undefined" ? GM_info?.script?.version : undefined,
                page,
                contentLocale: detectLocale(),
                guiLocale: store.getByPath("gui.locale"),
                logLevel: getLogLevel(),
                sessionId: records[0]?.ctx.sessionId,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : undefined,
            },
            records,
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            setCopyStatus("ok");
        } catch (e) {
            setCopyStatus("error");
            log.error(SCOPES.GUI, "copy debug report failed", e);
        }
    }
</script>

<Section id="tweaks" title={t("sec.tweaks")} desc={t("sec.tweaks.desc")}>
    <Field label={t("field.tweaksEnabled")}
        ><Switch path="system.tweaksEnabled" onChange={(v) => setTweaksEnabled(v)} /></Field
    >
    <Field label={t("field.anonymize")}><Switch path="system.anonymize" onChange={(v) => setAnonymize(v)} /></Field>
    <Field label={t("field.anonymizeBlur")}><Stepper path="system.anonymizeBlur" min={2} max={50} unit="px" /></Field>
</Section>

<Section id="panel" title={t("sec.panel")} desc={t("sec.panel.desc")}>
    <Field label={t("field.language")}><Select path="gui.locale" options={getLocaleOptions()} /></Field>
    <Field label={t("field.autoOpen")}><Switch path="debug.autoOpen" /></Field>
    <Field label={t("field.width")}><Stepper path="gui.widthPct" min={30} max={90} unit="%" /></Field>
    <Field label={t("field.height")}><Stepper path="gui.heightPct" min={30} max={90} unit="%" /></Field>
    <Field label={t("field.backdropOpacity")}><Stepper path="gui.backdropOpacity" min={0} max={100} unit="%" /></Field>
    <Field label={t("field.posMaxAgeHours")}><Stepper path="gui.posMaxAgeHours" min={0} max={168} unit="h" /></Field>
</Section>

<Section id="logging" title={t("sec.logging")} desc={t("sec.logging.desc")}>
    <Field label={t("field.verbosityLevel")}>
        <Select path="debug.logLevel" options={logLevelOptions} onChange={onLogLevelChange} />
    </Field>
    <Field label={t("field.debugReport")} desc={t("field.debugReport.desc")}>
        <button class="yt-tweaks-debug-report" type="button" onclick={onCopyDebugReport}>
            {t("btn.copyDebugReport")}
        </button>
    </Field>
    {#if copyStatus}
        <div
            class="yt-tweaks-debug-report-status"
            class:yt-tweaks-debug-report-ok={copyStatus === "ok"}
            class:yt-tweaks-debug-report-error={copyStatus !== "ok"}
        >
            {t(
                copyStatus === "ok"
                    ? "msg.copyDebugReportOk"
                    : copyStatus === "empty"
                      ? "msg.copyDebugReportEmpty"
                      : "msg.copyDebugReportFailed",
            )}
        </div>
    {/if}
</Section>

<Section id="status" title={t("sec.status")} desc={t("sec.status.desc")}>
    <div class="yt-tweaks-debug-status" id="yt-tweaks-debug-status">
        {#each Object.entries(stats) as [k, v] (k)}
            <div class="yt-tweaks-debug-row">
                <span class="yt-tweaks-about-key">{k}</span>
                <span class="yt-tweaks-about-val">{v}</span>
            </div>
        {/each}
    </div>
</Section>
