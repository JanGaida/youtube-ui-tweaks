<script lang="ts">
    /**
     * About tab: version (GM_info), author, GitHub link, and changelog.
     *
     * Wrapped in a Section for Pill-Nav consistency (the about category has one
     * section). ! Metadata must be kept in sync with the `vite.config.ts` userscript
     * block.
     */
    import Section from "../components/Section.svelte";
    import Icon from "../components/Icon.svelte";
    import { EXTERNAL_ICON, SUB_ICONS } from "../icons";
    import { changelogFor, decodeChangelog, parseChangelog } from "../about-changelog";
    import { t } from "../i18n.svelte";
    import log, { isDebugEnabled } from "../../core/log";

    // * GM_info fields read beyond the typed subset (diagnostic snapshot only — optional
    //   per the Tampermonkey docs, absent under some handlers).
    interface ScriptInfo {
        version?: string;
        name?: string;
        namespace?: string | null;
        header?: string | null;
        fileURL?: string | null;
        updateURL?: string | null;
        downloadURL?: string | null;
        lastModified?: number;
    }
    interface GMInfoSnapshot {
        scriptHandler?: string;
        version?: string;
        script?: ScriptInfo;
    }

    // * Version: the userscript header version — `GM_info.script.version` is REQUIRED
    //   in the Tampermonkey GM_info type and carries the header @version; the top-level
    //   `GM_info.version` is optional and observed to return the script-handler (TM
    //   extension) version on some TM builds (5.5.0) — fall back to it only when the
    //   handler exposes no script object (e2e polyfill). See ADR 0010.
    // warn: GM_info is Tampermonkey-provided; the e2e gm-polyfill stubs it.
    // * ! Author/GitHub metadata must still be kept in sync with vite.config.ts.
    // * Changelog: embedded at build time via `__CHANGELOG__` (ADR 0010) — parsed
    //   from the raw release-please markdown at module init. The rendered entry is
    //   the section of the installed version (fallback: newest entry for foreign
    //   versions, e.g. the e2e stub). A mismatch note surfaces stale/foreign
    //   installs — the panel can no longer lie without hinting at it.
    const VERSION =
        typeof GM_info !== "undefined" ? (GM_info.script?.version ?? GM_info.version ?? "unknown") : "unknown";
    const AUTHOR = "Jan Gaida";
    const GITHUB_URL = "https://github.com/JanGaida/youtube-ui-tweaks";
    const GITHUB_LABEL = "JanGaida/youtube-ui-tweaks";
    const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;

    const changelog = parseChangelog(decodeChangelog(__CHANGELOG_B64__));
    const entry = changelogFor(changelog, VERSION);
    const mismatch = entry !== undefined && entry.version !== VERSION;
    // * Changelog content is intentionally not translated (version numbers are universal).

    // * Bullet rendering: release-please bullets carry their scope as "scope: message" —
    //   the scope is highlighted up to the FIRST ": ", the rest stays plain message text.
    function bulletScope(text: string): string | null {
        const idx = text.indexOf(": ");
        return idx > 0 ? text.slice(0, idx) : null;
    }
    function bulletMessage(text: string): string {
        const idx = text.indexOf(": ");
        return idx > 0 ? text.slice(idx + 2) : text;
    }

    // * Diagnostic snapshot when the About tab opens — serialized GM_info is the decisive
    //   record for "which version does the script manager actually report?" (top-level
    //   version vs. script.version, stored header, updateURL). Debug-gated per ADR 0005:
    //   set the Logging level (system tab) to "debug", then open About. `scriptMetaStr` /
    //   `script.header` show the STORED metadata the manager parsed from the install —
    //   @version there is the authoritative installed value.
    $effect(() => {
        if (!isDebugEnabled()) return;
        const gm = typeof GM_info !== "undefined" ? (GM_info as Partial<GMInfoSnapshot>) : null;
        const payload = {
            panelVersion: VERSION,
            panelVersionSource:
                gm?.script?.version !== undefined
                    ? "GM_info.script.version"
                    : gm?.version !== undefined
                      ? "GM_info.version (fallback)"
                      : "none",
            changelogBuildEntry: entry?.version ?? null,
            mismatch,
            gmInfo: {
                scriptHandler: gm?.scriptHandler,
                version_topLevel: gm?.version,
                script_version: gm?.script?.version,
                script_name: gm?.script?.name,
                script_namespace: gm?.script?.namespace,
                script_header: gm?.script?.header,
                script_fileURL: gm?.script?.fileURL,
                script_updateURL: gm?.script?.updateURL,
                script_downloadURL: gm?.script?.downloadURL,
                script_lastModified: gm?.script?.lastModified,
            },
            serialized: JSON.stringify(gm, null, 2),
        };
        log.debug("about", "GM_info snapshot (About opened)", payload);
    });
</script>

<Section id="about" title={t("sec.about")}>
    <div class="yt-tweaks-about">
        <div class="yt-tweaks-about-title">YouTube UI Tweaks</div>
        <div class="yt-tweaks-about-rows">
            <div class="yt-tweaks-about-row">
                <span class="yt-tweaks-about-key">{t("about.version")}</span>
                <span class="yt-tweaks-about-val yt-tweaks-about-pill">{VERSION}</span>
            </div>
            <div class="yt-tweaks-about-row">
                <span class="yt-tweaks-about-key">{t("about.author")}</span>
                <span class="yt-tweaks-about-val">{AUTHOR}</span>
            </div>
            <div class="yt-tweaks-about-row">
                <span class="yt-tweaks-about-key">{t("about.github")}</span>
                <a class="yt-tweaks-about-link yt-tweaks-about-val" href={GITHUB_URL} target="_blank" rel="noreferrer">
                    <Icon path={SUB_ICONS.github} size={14} filled />
                    {GITHUB_LABEL}
                </a>
            </div>
        </div>
        {#if entry}
            <div class="yt-tweaks-about-changelog">
                <div class="yt-tweaks-changelog-head">
                    <span class="yt-tweaks-changelog-title">{t("about.changelog")}</span>
                    <span class="yt-tweaks-changelog-pill"
                        >v{entry.version}<span class="yt-tweaks-changelog-date">{entry.date}</span></span
                    >
                </div>
                {#if mismatch}
                    <div class="yt-tweaks-changelog-mismatch">{t("about.changelogMismatch")}</div>
                {/if}
                <div class="yt-tweaks-changelog-body">
                    {#each entry.items as item (item.kind + item.text)}
                        {#if item.kind === "group"}
                            <div class="yt-tweaks-changelog-group">{item.text}</div>
                        {:else}
                            <div class="yt-tweaks-changelog-entry">
                                {#if bulletScope(item.text)}
                                    <span class="yt-tweaks-changelog-scope">{bulletScope(item.text)}</span>
                                {/if}
                                {bulletMessage(item.text)}
                            </div>
                        {/if}
                    {/each}
                </div>
                <a class="yt-tweaks-changelog-full" href={CHANGELOG_URL} target="_blank" rel="noreferrer">
                    <Icon path={EXTERNAL_ICON} size={12} />
                    {t("about.changelogFull")}
                </a>
            </div>
        {/if}
    </div>
</Section>
