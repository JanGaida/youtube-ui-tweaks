import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import { runTextShorten, restoreText } from "../text";
import { metaIconsCss } from "./meta-icons";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: text-shorten feature — view-count + date shortening (DOM pass) + meta icons (CSS)
// ─────────────────────────────────────────────────────────────────────────────
// * Runs the text-shortening DOM pass on grid-bearing pages (home, subscriptions, channel,
//   search) AND on watch (the recommendation sidebar uses the same yt-lockup-view-model /
//   .ytContentMetadataViewModelMetadataText structure). CSS-free — pure DOM textContent edit.
// * Additionally emits the meta-icons CSS (eye before views, clock before date — pure
//   ::before + mask-image, no DOM pass; see meta-icons.ts).

/**
 * Runs the text-shorten pass (delegates to text.ts).
 *
 * @param ctx - The page context.
 */
function textRun(ctx: PageCtx): void {
    runTextShorten(ctx.settings, ctx.locale);
}

/**
 * Aggregates the meta-icons CSS (meta-icons.ts) for the textShorten slice.
 *
 * @param slice - The textShorten settings slice.
 * @returns CSS rule strings.
 */
function textCss(slice: unknown): string[] {
    return metaIconsCss(slice);
}

/**
 * Text-shorten feature: shortens view counts and relative dates in grid metadata.
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (captured 2026-08-09, locale=de)
 *   Selector .ytContentMetadataViewModelMetadataText → light DOM, 2 matches per grid item.
 *   __fixtures__/watch-recommendations.fixture.html (captured 2026-08-10, locale=de) covers
 *   the watch-page recommendation sidebar (same selector, same structure).
 * ~ DECISION-LOG: pure textContent replace (no DOM structure change). Idempotent via
 *   data-yt-tweaked marker; original preserved in data-yt-tweaked-original for restore.
 *   watch was initially excluded ("no grid metadata rows there") but the recommendation
 *   sidebar reuses the grid-item lockup structure → now included.
 */
export const textShortenFeature: Feature = {
    id: "text-shorten",
    settingsPath: "textShorten",
    pages: {
        home: { css: textCss, run: textRun, restore: restoreText },
        subscriptions: { css: textCss, run: textRun, restore: restoreText },
        channel: { css: textCss, run: textRun, restore: restoreText },
        search: { css: textCss, run: textRun, restore: restoreText },
        watch: { css: textCss, run: textRun, restore: restoreText },
    },
    liveApplyKeys: [
        "textShorten.shortenViews",
        "textShorten.shortenDate",
        "textShorten.viewsWordMode",
        "textShorten.icons.viewsIcon",
        "textShorten.icons.dateIcon",
        "textShorten.icons.sizeEm",
        "textShorten.views.roundMode",
        "textShorten.views.decimals",
        "textShorten.views.suffixes.k",
        "textShorten.views.suffixes.M",
        "textShorten.views.suffixes.B",
        "textShorten.views.suffixes.T",
        "textShorten.dateFormats.years",
        "textShorten.dateFormats.months",
        "textShorten.dateFormats.weeks",
        "textShorten.dateFormats.days",
        "textShorten.dateFormats.hours",
        "textShorten.dateFormats.minutes",
    ],
};
