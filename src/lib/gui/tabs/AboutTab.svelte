<script lang="ts">
    /**
     * About tab: version (GM_info), author, GitHub link, and changelog.
     *
     * Wrapped in a Section for Pill-Nav consistency (the about category has one
     * section). ! Metadata must be kept in sync with the `vite.config.ts` userscript
     * block.
     */
    import Section from "../components/Section.svelte";
    import { t } from "../i18n.svelte";

    // * Version from GM_info (userscript header) — single source of truth.
    //   release-please bumps package.json + the @version header, GM_info mirrors
    //   it at runtime → the tab can never drift from the released version again.
    // warn: GM_info is Tampermonkey-provided; the e2e gm-polyfill stubs it.
    // * ! Author/GitHub metadata must still be kept in sync with vite.config.ts.
    // * Changelog entry intentionally not translated (version number is universal).
    const VERSION = typeof GM_info !== "undefined" ? GM_info.version : "unknown";
    const AUTHOR = "Jan Gaida";
    const GITHUB_URL = "https://github.com/JanGaida/youtube-ui-tweaks";
    const GITHUB_LABEL = "JanGaida/youtube-ui-tweaks";
</script>

<Section id="about" title={t("sec.about")}>
    <div class="yt-tweaks-about">
        <div class="yt-tweaks-about-title">YouTube UI Tweaks</div>
        <div class="yt-tweaks-about-row">
            <span class="yt-tweaks-about-key">{t("about.version")}</span>
            <span class="yt-tweaks-about-val">{VERSION}</span>
        </div>
        <div class="yt-tweaks-about-row">
            <span class="yt-tweaks-about-key">{t("about.author")}</span>
            <span class="yt-tweaks-about-val">{AUTHOR}</span>
        </div>
        <div class="yt-tweaks-about-row">
            <span class="yt-tweaks-about-key">{t("about.github")}</span>
            <a class="yt-tweaks-about-link" href={GITHUB_URL} target="_blank" rel="noreferrer">{GITHUB_LABEL}</a>
        </div>
        <div class="yt-tweaks-about-changelog">
            <div class="yt-tweaks-changelog-title">{t("about.changelog")}</div>
            <div class="yt-tweaks-changelog-entry">v{VERSION} — Initial release</div>
        </div>
    </div>
</Section>
