import type { Settings, ViewsSettings } from "./settings";
import { LOCALE_PATTERNS, DATE_FIXED_VALUES } from "./locale";
import log, { isDebugEnabled } from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Constants — views policy (round + adaptive decimals, hardcoded)
// ─────────────────────────────────────────────────────────────────────────────
// * Views formatting comes from settings.textShorten.views:
//   roundMode (round/truncate), decimals (0/1/2), suffixes (k/M/B), thresholds.
//   unitRaw: optional YT-supplied unit ("Mio."/"Tsd."/"M"/"K") → multiplied in.

// * Number parsing is CONTENT-LOCALE-dependent (the language of the YT UI, not the GUI):
//   de: "." = grouping, "," = decimal ("270.417" → 270417, "1,5" → 1.5)
//   en: "," = grouping, "." = decimal ("294,234" → 294234, "1.5" → 1.5)
//   Parsing with the wrong policy corrupts the value ("1.5M" → "15M"), so the
//   content locale must be threaded through from shortenText.
function parseViewsNumber(raw: string, locale: string): number {
    const s = String(raw).replace(/\s/g, "");
    const normalized = locale === "en" ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
    return Number(normalized);
}

/**
 * Formats a raw view-count number with the configured rounding policy and unit suffix.
 *
 * Handles YT-supplied units ("Mio."/"Tsd." in German, "M"/"K" in English) by multiplying before
 * scaling. Below 1000, returns the rounded raw number. Non-numeric input returns null.
 *
 * @param raw     - The numeric string as captured from the YT DOM (may contain `.`/`,` separators).
 * @param unitRaw - Optional YT-supplied unit string ("Mio.", "Tsd.", "M", "K").
 * @param vcfg    - The view-formatting settings (roundMode, decimals, suffixes).
 * @param locale  - The content locale — selects the number parsing policy AND the decimal
 *                  separator of the formatted output (de "," / en "."). Defaults to "de" so
 *                  plain-call tests keep the historical German-format contract.
 * @returns The formatted string (e.g. "1,2M" for de, "1.2M" for en), or null if not a number.
 */
export function formatViewsNumber(raw: string, unitRaw: string, vcfg: ViewsSettings, locale = "de"): string | null {
    let n = parseViewsNumber(raw, locale);
    if (Number.isNaN(n)) return null;
    const u = (unitRaw || "").trim();
    if (/Tsd|K/i.test(u)) n *= 1e3;
    else if (/Mio|M/i.test(u)) n *= 1e6;

    const order = [
        { th: 1e12, key: "T" },
        { th: 1e9, key: "B" },
        { th: 1e6, key: "M" },
        { th: 1e3, key: "k" },
    ];
    const decSep = locale === "en" ? "." : ",";
    for (const u2 of order) {
        if (n >= u2.th) {
            let scaled = n / u2.th;
            if (vcfg.roundMode === "truncate") {
                const factor = Math.pow(10, vcfg.decimals);
                scaled = Math.floor(scaled * factor) / factor;
            } else {
                scaled = Number(scaled.toFixed(vcfg.decimals));
            }
            const body = String(scaled).replace(".", decSep);
            return `${body}${vcfg.suffixes[u2.key as "k" | "M" | "B" | "T"]}`;
        }
    }
    return String(Math.round(n));
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Phase 3 — text shortening
// ─────────────────────────────────────────────────────────────────────────────

/** CSS selector matching the metadata text nodes that contain views/dates in grid items. */
export const TEXT_SELECTOR = ".ytContentMetadataViewModelMetadataText";

/** Marker attribute set on elements classified as views texts (drives the eye icon CSS). */
export const VIEWS_MARKER = "data-yt-tweaks-views";

/** Marker attribute set on elements classified as date texts (drives the clock icon CSS). */
export const DATE_MARKER = "data-yt-tweaks-date";

/**
 * Shortens the text content of a single metadata element (views + date) in place.
 *
 * Idempotent: elements already marked `data-yt-tweaked` are skipped. The original text is
 * preserved in `data-yt-tweaked-original` so `restoreText` can undo the change.
 *
 * @param el       - The metadata text element to shorten.
 * @param settings - The current settings (drives shortenViews/shortenDate + formats).
 * @param locale   - The content locale (selects the regex pattern set).
 */
export function shortenText(el: HTMLElement, settings: Settings, locale: string): void {
    if (el.dataset.ytTweaked) return;
    const patterns = LOCALE_PATTERNS[locale];
    if (!patterns) {
        log.warn("text", `no patterns for locale "${locale}"`);
        return;
    }

    // * Store the original BEFORE modifying (C3)
    const original = el.textContent || "";
    el.dataset.ytTweakedOriginal = original;

    let text = original;

    // * Views: number (+optional YT unit) + word "Aufrufe"/"views" → policy + viewsWordMode.
    //   viewsWordMode:"locale" appends the locale-native word (de "Aufrufe", en "views"),
    //   "none" leaves the number alone (the views icon carries the meaning). Replaces the
    //   old viewsText free-text field (ADR 0006).
    //   ! Classification marker (bug #11 fix): live rows mix channel names + views + date in ONE
    //   metadata row ("Name • Name2 • ▶62.345 • vor 11 Tagen") — structural CSS scoping is
    //   impossible (channel names can be plain text without <a>, so even the link anchor fails).
    //   The regex is the ONLY reliable classifier. Views marker is set ONLY when the views
    //   regex actually matched — never blanket-marked. The eye-icon CSS selects the marker
    //   instead of structural selectors.
    if (settings.textShorten.shortenViews) {
        const v = patterns.views;
        const vcfg = settings.textShorten.views;
        let matchedViews = false;
        text = text.replace(v.regex, (match, num, unit) => {
            const formatted = formatViewsNumber(num, unit, vcfg, locale);
            if (formatted === null) return match;
            matchedViews = true;
            const word = settings.textShorten.viewsWordMode === "locale" ? patterns.viewsWord : "";
            return word ? `${formatted} ${word}` : formatted;
        });
        if (matchedViews) el.setAttribute(VIEWS_MARKER, "1");
    }

    // * Date: user-defined abbreviation from dateFormats[ key ]
    //   ! Date classification marker — same rationale as the views marker (bug #11): the
    //   clock icon targets the marker, not structural position (LastPart lies — live rows put
    //   the date last but channel names in LastPart position also exist).
    if (settings.textShorten.shortenDate) {
        for (const d of patterns.date) {
            const m = text.match(d.regex);
            if (!m) continue;
            const suffix =
                settings.textShorten.dateFormats[d.key as keyof typeof settings.textShorten.dateFormats] || "";
            // * yesterday/today regex (no capture) → fixed value from DATE_FIXED_VALUES.
            //   Lookup is case-insensitive (text trimmed + lowercased) — the fixed-value
            //   regexes must therefore match case-insensitively too, or "Heute" never
            //   reaches this branch.
            const fixedKey = text.trim().toLowerCase();
            if (DATE_FIXED_VALUES[fixedKey] !== undefined) {
                text = `${DATE_FIXED_VALUES[fixedKey]}${suffix}`;
            } else {
                text = text.replace(d.regex, `$1${suffix}`);
            }
            el.setAttribute(DATE_MARKER, "1");
            break;
        }
    }

    // * Markers are set exclusively inside their respective pass — the icon toggles are
    //   separately gated on shortenViews/shortenDate (meta-icons.ts), so a disabled pass
    //   leaves no marker and thus no icon.

    if (text !== original) {
        el.textContent = text;
        // * Hot path (runs per shortened element during scroll) — build the debug string
        //   only when debug logging is actually on.
        if (isDebugEnabled()) log.debug("text", `"${original.trim()}" → "${text.trim()}"`);
    }
    // * The processed marker is set even when nothing matched: it makes this function
    //   idempotent against the observer's repeated passes (unmatched elements would be
    //   re-regexed on every mutation otherwise — hot path). restoreText clears it.
    el.dataset.ytTweaked = "1";
}

/** Restores all shortened metadata elements to their original text and clears tweak markers. */
export function restoreText(): void {
    document.querySelectorAll<HTMLElement>("[data-yt-tweaked-original]").forEach((el) => {
        if (el.dataset.ytTweakedOriginal !== undefined) el.textContent = el.dataset.ytTweakedOriginal;
        delete el.dataset.ytTweakedOriginal;
        delete el.dataset.ytTweaked;
        // * Classification markers go too (bug #11: marker drives the icon CSS — a stale
        //   marker without re-classification would paint icons on un-classified texts).
        el.removeAttribute(VIEWS_MARKER);
        el.removeAttribute(DATE_MARKER);
    });
}

/**
 * Runs `shortenText` over all unprocessed metadata text elements in the document.
 *
 * @param settings - The current settings.
 * @param locale   - The content locale.
 */
export function runTextShorten(settings: Settings, locale: string): void {
    document.querySelectorAll<HTMLElement>(`${TEXT_SELECTOR}:not([data-yt-tweaked])`).forEach((el) => {
        shortenText(el, settings, locale);
    });
}
