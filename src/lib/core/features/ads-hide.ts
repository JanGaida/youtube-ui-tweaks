import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { AdsSettings } from "../settings";
import { hideAds, restoreAds } from "../ads";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: ads-hide feature — premium/big-screen/discover CSS + member-only DOM pass
// ─────────────────────────────────────────────────────────────────────────────
// * Premium banner + big-screen + discover shelf: pure CSS (display:none !important via :has()).
// * Member-only grid items + watch-sidebar lockups: pure CSS :has() on the ytBadgeShapeCommerce
//   badge class (language-independent). The DOM pass covers only the Shorts shelf (title match)
//   and the member-only shelf text-match fallback on home + subscriptions (where shelves appear).

/**
 * Builds the premium-banner + big-screen + discover-section + gaming + survey CSS rules.
 *
 * Three gated groups (promo / shelves / survey): each group's rules are emitted only when its
 * `enabled` flag is true AND the individual `hide*` toggle is set. Group off → no rules for that
 * group (mirrors `if (!s.enabled) return []` in sibling features).
 *
 * - Premium banner: promo/dialog renderers.
 * - Big-screen / promoted shelves: `ytd-brand-video-shelf-renderer` carrying the
 *   `ytBadgeShapePromoted` badge ("Von YouTube empfohlen" / "Recommended by YouTube").
 * - Discover shelf: `ytd-chips-shelf-with-video-shelf-renderer`.
 * - Game shelves: `ytd-game-card-renderer` + dynamic box-art shelves + Playables mini-game cards.
 * - Inline survey: `ytd-inline-survey-renderer`.
 *
 * All are hidden via pure-CSS `:has()` rules on the outer `ytd-rich-section-renderer`
 * (display:none !important). This is more robust than a DOM pass: it covers the entire outer
 * wrapper (no leftover divider/empty space), survives Polymer re-renders (CSS is not cleared by
 * re-render), and is language-independent.
 *
 * @param slice - The ads settings slice (nested: promo / shelves / survey).
 * @returns CSS rule strings.
 */
function adsCss(slice: unknown): string[] {
    const a = slice as AdsSettings;
    const rules: string[] = [];

    // * Gruppe 1 — Promo (Premium-Banner + Big-Screen + Member-Only via CSS).
    if (a.promo.enabled && a.promo.hidePremiumBanner) {
        // * Hide the promo renderers themselves — covers top-of-page banners (mealbar/banner-promo)
        // * and the membership-offer dialog, which live OUTSIDE the grid (no rich-section wrapper).
        rules.push(
            `ytd-banner-promo-renderer, ytd-mealbar-promo-renderer, ytd-statement-banner-renderer, tp-yt-paper-dialog:has(ytd-membership-offer-renderer) { display: none !important; }`,
        );
        // * Hide the ENTIRE outer rich-section when it wraps a promo banner. Without this, hiding
        // * only the inner renderer leaves the empty rich-section wrapper visible, which creates a
        // * gap in the grid and breaks the row-count override from the startpage feature (e.g. a
        // * stray empty row at row=4). CSS :has() on the outer rich-section is re-render-safe
        // * (also backstops the fragile inline display:none from the member-only DOM pass).
        rules.push(
            `ytd-rich-section-renderer:has(ytd-statement-banner-renderer, ytd-banner-promo-renderer, ytd-mealbar-promo-renderer) { display: none !important; }`,
        );
    }
    if (a.promo.enabled && a.promo.hideMemberOnly) {
        // * Hide member-only grid items ("Nur für Kanalmitglieder" / "Members only") — the badge
        // * in the live lockup structure (user-reported 2026-10-24) is
        // * <badge-shape class="… ytBadgeShapeCommerce …"> inside yt-lockup-view-model metadata.
        // * Class-based match = content-locale-independent (works for every UI language), unlike
        // * the old DOM pass which probed badge-style-type-members-only (dead class — fixture
        // * probe-count 0 since 2026-08-23) and the locale-locked adsText fallback.
        // * Pure CSS :has() on the OUTER ytd-rich-item-renderer — hides the whole grid item so no
        // * empty grid cell remains (the startpage row-count override stays intact), and it is
        // * re-render-safe (no inline style Polymer could clear — ADR 0001 rationale).
        // ! Fails safe: no Commerce badge → no match → nothing hidden. If YT ever uses
        // ! ytBadgeShapeCommerce for non-member commerce badges, over-hide is the drift mode —
        // * live-verify after rollout (watch feed + sidebar for false positives).
        rules.push(`ytd-rich-item-renderer:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`);
        // * Watch-page recommendation sidebar: items are BARE yt-lockup-view-model elements (no
        // * ytd-rich-item-renderer wrapper — see watch-recommendations.fixture.html), direct
        // * children inside ytd-watch-next-secondary-results-renderer. The lockup itself is the
        // * outermost hideable node there, so :has() targets it directly. Scoped to the sidebar
        // * container to avoid matching lockups on unrelated surfaces.
        rules.push(
            `ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(badge-shape.ytBadgeShapeCommerce) { display: none !important; }`,
        );
    }
    if (a.promo.enabled && a.promo.hideBigScreenAds) {
        // * Hide "Von YouTube empfohlen" promoted brand shelves — matched via the
        // * ytBadgeShapePromoted badge class inside a ytd-brand-video-shelf-renderer.
        // * Language-independent (badge-class match, no text-match), so no false positives on
        // * normal brand shelves. Pure CSS :has() on the outer rich-section — re-render-safe
        // * (no inline style to clear, survives Polymer re-renders), no leftover wrapper/divider.
        // ! Was previously a DOM pass (text-match + inline style.display:none) that was cleared
        // * by Polymer re-renders, letting the shelf reappear — same fragility that hideDiscoverSection
        // * had and was migrated to CSS :has(). See git history + ads-hide.ts DECISION-LOG.
        rules.push(
            `ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer .ytBadgeShapePromoted) { display: none !important; }`,
        );
    }

    // * Gruppe 2 — Shelves (Discover + Shorts + Gaming).
    if (a.shelves.enabled && a.shelves.hideDiscoverSection) {
        // * Hide the ENTIRE outer rich-section (not just the inner chips shelf) — the DOM pass
        //   only hid the inner custom element, leaving the outer wrapper visible (empty space +
        //   bottom divider). CSS :has() + !important is re-render-safe (no inline style to clear).
        rules.push(
            `ytd-rich-section-renderer:has(ytd-chips-shelf-with-video-shelf-renderer) { display: none !important; }`,
        );
    }
    if (a.shelves.enabled && a.shelves.hideGameShelves) {
        // * Hide gaming shelves ("Die besten Livespiele" etc.) — ytd-rich-shelf-renderer wrapping
        // * ytd-game-card-renderer (box-art game tiles). Re-render-safe pure CSS :has() on the
        // * outer rich-section — game-card element match, language-independent, no false positives
        // * on normal video shelves. Hides the outer wrapper so no grid gap remains.
        rules.push(`ytd-rich-section-renderer:has(ytd-game-card-renderer) { display: none !important; }`);
    }
    if (a.shelves.enabled && a.shelves.hideDynamicGameShelves) {
        // * Hide dynamic gaming shelves ("Mehr von diesem Spiel" — game-related video
        // * recommendations). Identified by the has-rounded-box-art-thumbnail-style attribute on
        // * ytd-rich-shelf-renderer (present on game-themed video shelves, absent on the game-tile
        // * shelf which hideGameShelves covers via ytd-game-card-renderer, and absent on the Shorts
        // * shelf). Re-render-safe pure CSS :has() + attribute selector, language-independent.
        rules.push(
            `ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[has-rounded-box-art-thumbnail-style]) { display: none !important; }`,
        );
    }
    if (a.shelves.enabled && a.shelves.hidePlayablesShelf) {
        // * Hide the Playables shelf ("Playables — Instant-Games, keine Downloads") —
        // * ytd-rich-shelf-renderer wrapping ytd-mini-game-card-view-model portrait game cards
        // * (links to /playables). Distinct from the game-tile shelf (hideGameShelves via
        // * ytd-game-card-renderer) and the box-art video shelves (hideDynamicGameShelves):
        // * Playables uses its own mini-game card view-model. Re-render-safe pure CSS :has() on
        // * the outer rich-section — element match, language-independent, no false positives on
        // * normal video shelves. Hides the outer wrapper so no grid gap remains.
        rules.push(`ytd-rich-section-renderer:has(ytd-mini-game-card-view-model) { display: none !important; }`);
    }
    if (a.shelves.enabled && a.shelves.hideContinueWatchingShelf) {
        // * Hide the "Continue watching" shelf ("Weiter ansehen") — ytd-rich-shelf-renderer whose
        // * item links carry a &t= resume timestamp (e.g. /watch?v=X&t=1005s). No dedicated
        // * element or attribute on this shelf — the resume-timestamp link is the only structural
        // * marker, language-independent. Scoped to the shelf renderer — main-grid items outside
        // * rich-sections are never matched (selector requires the rich-shelf wrapper).
        // * warn: false positive possible on other shelves containing a partially-watched video
        // * with a &t= link — accepted trade-off (decided over the localized title-match DOM pass).
        // * Re-render-safe pure CSS :has() on the outer rich-section — hides the outer wrapper
        // * so no grid gap remains.
        rules.push(
            `ytd-rich-section-renderer:has(ytd-rich-shelf-renderer a[href*="&t="]) { display: none !important; }`,
        );
    }

    // * Gruppe 3 — Survey (Inline-Sterne-Bewertung).
    if (a.survey.enabled && a.survey.hideInlineSurvey) {
        // * Hide the inline star-rating survey ("Wie hat dir dieses Video gefallen?") — wrapped in a
        // * ytd-rich-section-renderer. Re-render-safe pure CSS :has() on the outer rich-section —
        // * element match (ytd-inline-survey-renderer), language-independent, hides the outer
        // * wrapper so no grid gap remains (console-validated: grid closes cleanly).
        rules.push(`ytd-rich-section-renderer:has(ytd-inline-survey-renderer) { display: none !important; }`);
    }
    return rules;
}

/**
 * Runs the ads-hiding DOM pass — shorts shelf + member-only shelf text fallback (delegates to
 * ads.ts). Member-only grid items + watch-sidebar lockups are pure CSS (see adsCss) — not here.
 *
 * @param ctx - The page context.
 */
function adsRun(ctx: PageCtx): void {
    hideAds(ctx.settings, ctx.locale);
}

/**
 * Ads-hide feature: hides Premium banner (CSS) + big-screen/promoted shelves (CSS :has) +
 * discover shelf (CSS :has) + member-only grid items + watch-sidebar lockups (CSS :has) +
 * shorts shelf + member-only shelves (DOM pass).
 *
 * ! Group gating: three groups (promo / shelves / survey), each with its own `enabled` Super-Switch.
 *   A group's CSS rules + DOM pass are skipped when the group is disabled — mirrors the sibling
 *   features' `if (!s.enabled) return []` pattern. The individual `hide*` toggles only take effect
 *   within an enabled group.
 *
 * * DOM-Fixture: __fixtures__/member-only-lockup.fixture.html (captured 2026-10-24 from a
 *   user-reported live home-grid DOM — badge-shape.ytBadgeShapeCommerce inside the lockup).
 *   Shadow-DOM-Grenze: none for these selectors.
 * ~ DECISION-LOG: member-only was a DOM pass probing badge-style-type-members-only — that class
 * ~ is dead in the lockup structure (fixture probe-count 0 since 2026-08-23) and the pass never
 * ~ matched. Migrated to pure CSS :has() on the live ytBadgeShapeCommerce badge class (grid +
 * ~ watch sidebar), mirroring the hideBigScreenAds ytBadgeShapePromoted precedent: class match
 * ~ = content-locale-independent, :has()+!important = re-render-safe. The DOM pass retains the
 * ~ shelf text-match fallback (adsText) + the Shorts-shelf title pass.
 */
export const adsHideFeature: Feature = {
    id: "ads-hide",
    settingsPath: "ads",
    pages: {
        home: { css: adsCss, run: adsRun, restore: restoreAds },
        subscriptions: { css: adsCss, run: adsRun, restore: restoreAds },
        "*": { css: adsCss },
    },
    liveApplyKeys: [
        "ads.promo.enabled",
        "ads.promo.hidePremiumBanner",
        "ads.promo.hideBigScreenAds",
        "ads.promo.hideMemberOnly",
        "ads.shelves.enabled",
        "ads.shelves.hideDiscoverSection",
        "ads.shelves.hideShortsShelf",
        "ads.shelves.hideGameShelves",
        "ads.shelves.hideDynamicGameShelves",
        "ads.shelves.hidePlayablesShelf",
        "ads.shelves.hideContinueWatchingShelf",
        "ads.survey.enabled",
        "ads.survey.hideInlineSurvey",
    ],
};
