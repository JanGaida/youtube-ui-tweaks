<script lang="ts">
    /**
     * About tab: static version, author, GitHub link, and changelog.
     *
     * Wrapped in a Section for Pill-Nav consistency (the about category has one
     * section). ! Metadata must be kept in sync with the `vite.config.ts` userscript
     * block.
     */
    import Section from "../components/Section.svelte";
    import { t } from "../i18n.svelte";

    // * About tab: static (version/author/GitHub/changelog).
    // * ! Metadata must be kept in sync with the vite.config.ts userscript block.
    // * Changelog entry intentionally not translated (version number is universal).
    const VERSION = "1.0.0";
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
            <div class="yt-tweaks-changelog-entry">v1.0.0 — Initial release</div>
        </div>
    </div>
</Section>
