import { registerFeature } from "../registry";
import { composeDefaults } from "../registry";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { gridStylingFeature } from "./grid-styling";
import { autoSyncBadgeFeature } from "./auto-sync-badge";
import { dimWatchedFeature } from "./dim-watched";
import { previewDelayFeature } from "./preview-delay";
import { textShortenFeature } from "./text-shorten";
import { metaSplitFeature } from "./meta-split";
import { hideElementsFeature } from "./hide-elements";
import { adsHideFeature } from "./ads-hide";
import { mastheadCssFeature } from "./masthead-css";
import { mastheadButtonsFeature } from "./masthead-buttons";
import { guideVisibilityFeature } from "./guide-visibility";
import { guideStylingFeature } from "./guide-styling";
import { guideEntriesFeature } from "./guide-entries";
import { feedChipsFeature } from "./feed-chips";
import { watchChipsFeature } from "./watch-chips";
import { startpageGridFeature } from "./startpage-grid";
import { watchPageFeature } from "./watch-page";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Feature registration — registers all built-in features with the registry.
// ─────────────────────────────────────────────────────────────────────────────
// * Called once at boot (after initPageContext). Order matters only for run-order within a page;
//   CSS aggregation order is cosmetic (all rules join into one stylesheet).

/**
 * Registers all built-in features with the registry. Call once at boot.
 */
export function registerAllFeatures(): void {
    registerFeature(gridStylingFeature);
    registerFeature(autoSyncBadgeFeature);
    registerFeature(dimWatchedFeature);
    registerFeature(previewDelayFeature);
    registerFeature(textShortenFeature);
    // * meta-split MUST run after text-shorten (marker-fallback anchor — see meta-split.ts).
    registerFeature(metaSplitFeature);
    registerFeature(hideElementsFeature);
    registerFeature(adsHideFeature);
    registerFeature(mastheadCssFeature);
    registerFeature(mastheadButtonsFeature);
    registerFeature(guideVisibilityFeature);
    registerFeature(guideStylingFeature);
    registerFeature(guideEntriesFeature);
    registerFeature(feedChipsFeature);
    registerFeature(watchChipsFeature);
    registerFeature(startpageGridFeature);
    registerFeature(watchPageFeature);
}

/**
 * Returns the composed default settings: the central DEFAULT_SETTINGS overridden by each
 * feature's `defaults` slice (merged via composeDefaults).
 *
 * ! Phase 1: the central Settings interface remains the source of truth; feature defaults layer
 *   on top. Call after registerAllFeatures.
 *
 * @returns The composed default settings.
 */
export function getComposedDefaults(): Settings {
    return composeDefaults(DEFAULT_SETTINGS);
}
