import type { Settings } from "./settings";
import { LOCALE_PATTERNS } from "./locale";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Phase 4 — Ads/Content-Hiding (JS)
// ─────────────────────────────────────────────────────────────────────────────

/** Selectors for big-screen / premium brand shelves (text-matched against adsText). */
export const AD_BIGSCREEN_SELECTORS = "ytd-brand-video-shelf-renderer, ytd-rich-section-renderer";
/** Selector for the outer rich-section wrapper (used by the Shorts-shelf DOM pass). */
export const RICH_SECTION_SELECTOR = "ytd-rich-section-renderer";
/** Title text of the Shorts shelf — not localized by YouTube ("Shorts" everywhere). */
const SHORTS_SHELF_TITLE = "shorts";

/**
 * Tests whether an element's text content matches any of the locale's ad-detection strings.
 *
 * @param text    - The element text content to test.
 * @param adsText - The locale's ad-detection strings (case-insensitive substring match).
 * @returns True if any ad string is found.
 */
export function textMatchesAds(text: string, adsText: string[]): boolean {
    const t = (text || "").trim().toLowerCase();
    if (!t) return false;
    return adsText.some((a) => t.includes(a.toLowerCase()));
}

/**
 * Hides an element and marks it with `data-yt-tweaks-hidden` so `restoreAds` can undo it.
 *
 * @param el - The element to hide.
 */
export function hideElement(el: HTMLElement): void {
    el.style.display = "none";
    el.dataset.ytTweaksHidden = "1";
}

/**
 * Hides ads/promo content per the current settings (member-only shelves, shorts-shelf).
 *
 * Idempotent: already-hidden elements are skipped.
 *
 * ! Big-screen/promoted shelves, gaming shelves, the discover section, AND member-only grid
 * !   items + watch-sidebar lockups are hidden purely via CSS (`:has()` — see ads-hide.ts).
 * !   No DOM pass needed for them; inline-style approaches are cleared by Polymer re-renders,
 * !   letting shelves reappear. CSS :has()+!important is re-render-safe. This DOM pass handles
 * !   only the member-only shelf text-match fallback (rich-sections / brand shelves) and the
 * !   Shorts shelf (title text-match — no robust attribute available, so a DOM pass is required).
 *
 * @param settings - The current settings.
 * @param locale   - The content locale (selects the adsText pattern set).
 */
export function hideAds(settings: Settings, locale: string): void {
    const patterns = LOCALE_PATTERNS[locale];
    if (!patterns) {
        log.warn("ads", `no patterns for locale "${locale}"`);
        return;
    }

    // * Shorts-Shelf — no robust attribute on the shelf; detected via title text "Shorts" (YT does
    //   not localize this label). DOM pass (inline display:none on the outer rich-section) —
    //   Observer-backstopped on Polymer re-renders (re-applies hideElement). Hides the outer
    //   wrapper so no grid gap remains (preserves the startpage row-count override).
    //   ! Gated on the shelves group enable flag (group off → no DOM pass for this shelf).
    if (settings.ads.shelves.enabled && settings.ads.shelves.hideShortsShelf) {
        document.querySelectorAll<HTMLElement>(RICH_SECTION_SELECTOR).forEach((el) => {
            if (el.dataset.ytTweaksHidden) return;
            // * Match only the shelf header title (not the whole textContent — avoids matching
            //   "Shorts" in a video title inside the shelf). Hidden title span #title inside the
            //   rich-shelf header is the canonical Shorts label.
            const title = el.querySelector(
                "ytd-rich-shelf-renderer #rich-shelf-header span#title, ytd-rich-shelf-renderer h2 span#title",
            );
            if (title && title.textContent?.trim().toLowerCase() === SHORTS_SHELF_TITLE) {
                hideElement(el);
                log.info("ads", "shorts-shelf hidden (title match)");
            }
        });
    }

    // * Member-Only Shelves — text-match fallback ONLY (rich-sections / brand shelves).
    //   ! Gated on the promo group enable flag (group off → no DOM pass for member-only).
    //   ! Member-only GRID ITEMS + watch-sidebar lockups are NOT handled here — they are pure
    //   * CSS :has() on badge-shape.ytBadgeShapeCommerce (see ads-hide.ts), which replaced the
    //   * dead badge-class scan (badge-style-type-members-only: fixture probe-count 0 since
    //   * 2026-08-23 — the class no longer exists in the live lockup structure).
    if (settings.ads.promo.enabled && settings.ads.promo.hideMemberOnly) {
        document.querySelectorAll<HTMLElement>(AD_BIGSCREEN_SELECTORS).forEach((el) => {
            if (el.dataset.ytTweaksHidden) return;
            if (textMatchesAds(el.textContent || "", patterns.adsText)) {
                hideElement(el);
                log.info("ads", "member-only (text) hidden", el.tagName);
            }
        });
    }
}

/** Restores all hidden ad/promo elements to their original display and clears hide markers. */
export function restoreAds(): void {
    document.querySelectorAll<HTMLElement>("[data-yt-tweaks-hidden]").forEach((el) => {
        el.style.display = "";
        delete el.dataset.ytTweaksHidden;
    });
}
