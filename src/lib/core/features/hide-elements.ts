import type { Feature, ValidationError } from "../feature.types";
import type { HideElementsSettings } from "../settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: hide-elements feature — hides native YT elements inside grid-item lockups
// ─────────────────────────────────────────────────────────────────────────────
// * Pure CSS hides for YouTube-native elements in video-card lockups (the yt-lockup-view-model
//   structure used on home, subscriptions, channel, search + the watch recommendation sidebar).
//
// * hideVerifiedBadge (D7): the "Bestätigtes Original-Konto" checkmark is an inline icon inside
//   the channel-name link. DOM (fixture-verified, home-grid-item.fixture.html 2026-08-23):
//   the channel name is the only <a.ytAttributedStringLink> in the lockup's text container; the
//   checkmark sits inside it as
//   .ytAttributedStringInlineBlockMod > .ytAttributedStringImageElement (14px SVG, aria-label="").
//   The InlineBlockMod wrapper carries the 4px margin-left — hiding it removes icon + spacing.
//
// ! Caveat (slot-based hide): when YT renders a different inline icon in the same slot (e.g. the
//   music note on artist channels), it is hidden as well — the SVG content is not distinguishable
//   via CSS (aria-label is empty). Documented in the GUI description + arch doc.

/**
 * Validates the hide-elements slice: booleans must be booleans.
 *
 * @param slice - The hideElements settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateHideElements(slice: unknown): ValidationError[] {
    const s = slice as HideElementsSettings;
    const errors: ValidationError[] = [];
    if (typeof s.enabled !== "boolean") {
        errors.push({ path: "hideElements.enabled", message: "Must be a boolean" });
    }
    if (typeof s.hideVerifiedBadge !== "boolean") {
        errors.push({ path: "hideElements.hideVerifiedBadge", message: "Must be a boolean" });
    }
    return errors;
}

/**
 * Builds the hide-elements CSS rules.
 *
 * @param slice - The hideElements settings slice.
 * @returns CSS rule strings.
 */
function hideElementsCss(slice: unknown): string[] {
    const s = slice as HideElementsSettings;
    if (!s.enabled) return [];
    const rules: string[] = [];
    if (s.hideVerifiedBadge) {
        // * Verified checkmark hide (bug #12 fix — aria-label anchor, live-verified): the
        //   live DOM renders the checkmark as a SIBLING of the channel-name link, not inside
        //   it (the 3-week-old fixture structure is dead):
        //   <span class="…MetadataText">…<a class="ytAttributedStringLink">sampleworks</a>…</span>
        //   <span class="ytContentMetadataViewModelIcon" aria-label="Bestätigt" …>…checkmark SVG…</span>
        //   The aria-label is the exact semantic anchor — YouTube ships it with the verified
        //   badge. Scoped to the lockup metadata to avoid hitting other surfaces (watch-page
        //   description, comments) that also use attributed-string icons.
        //   ! aria-labels are CONTENT-locale-locked: de = "Bestätigt" (live-verified),
        //   en = "Verified" (well-known YT string, fails safe if it drifts — an unmatched
        //   label simply doesn't hide anything).
        //   ? Music-note co-hide: RESOLVED — the note carries a different aria-label, so it
        //   stays visible. Unlabeled variants are never matched (fails safe, no over-hide).
        const VERIFIED_LABELS = ["Bestätigt", "Verified"];
        const iconScope = VERIFIED_LABELS.map(
            (label) => `.ytLockupViewModelMetadata .ytContentMetadataViewModelIcon[aria-label="${label}"]`,
        ).join(", ");
        rules.push(`${iconScope} { display: none !important; }`);
    }
    return rules;
}

/**
 * Hide-elements feature: hides native YT elements inside grid-item lockups (pure CSS).
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (captured 2026-08-23, locale=de)
 *   a.ytAttributedStringLink > span.ytAttributedStringInlineBlockMod wraps the checkmark —
 *   light DOM. Same structure in watch-recommendations.fixture.html.
 * ~ DECISION-LOG: started as a single verified-badge toggle; structured as an extensible
 *   "hide native elements" group so future hides slot in as additional boolean rules.
 */
export const hideElementsFeature: Feature = {
    id: "hide-elements",
    settingsPath: "hideElements",
    pages: {
        home: { css: hideElementsCss },
        subscriptions: { css: hideElementsCss },
        channel: { css: hideElementsCss },
        search: { css: hideElementsCss },
        watch: { css: hideElementsCss },
    },
    liveApplyKeys: ["hideElements.enabled", "hideElements.hideVerifiedBadge"],
    defaults: {
        hideElements: {
            enabled: true,
            hideVerifiedBadge: false,
        },
    },
    validate: validateHideElements,
};
