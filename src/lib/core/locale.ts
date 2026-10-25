// ─────────────────────────────────────────────────────────────────────────────
// MARK: Constants — locale patterns (regex per locale, replacement via settings)
// ─────────────────────────────────────────────────────────────────────────────
// * The regex stays locale-specific (language of the YT UI). Replacement strings
//   come from settings.textShorten.dateFormats.

/** Locale-specific content-matching patterns for YouTube UI strings (views, dates, ads). */
export interface LocalePattern {
    /** Regex matching a view-count text; capture group 1 = number, group 2 = optional YT unit. */
    views: { regex: RegExp };
    /** Locale's native "views" word (de "Aufrufe", en "views") — used by viewsWordMode:"locale". */
    viewsWord: string;
    /** Date patterns; `key` maps to settings.textShorten.dateFormats, `regex` captures the count. */
    date: { key: string; regex: RegExp }[];
    /** Ad/promo detection strings (lowercased comparison) for the current locale. */
    adsText: string[];
}

/** Per-locale content patterns (de/en). Adding a GUI language does NOT add content-matching. */
export const LOCALE_PATTERNS: Record<string, LocalePattern> = {
    de: {
        // * Views: matches "1,1 Mio. Aufrufe" AND "12 Aufrufe" — number(+optional unit) + "Aufrufe".
        //   ~ watch-page: textContent is bare number ("270.417", no "Aufrufe" word — that's only in
        //     aria-label). The `u?` makes the "Aufrufe" word optional so bare numbers match too.
        //   ! ANCHORED ^…$ (bug #3 fix): the old unanchored pattern matched bare numbers inside
        //     DATE texts ("vor 17 Std." → "17" → "17 Aufrufe" + leftover "Std."). The full-string
        //     anchor only matches texts that are views texts and nothing else.
        views: { regex: /^\s*([\d.,]+)\s*(Mio\.|Tsd\.)?\s*(?:Aufrufe)?\s*$/u },
        viewsWord: "Aufrufe",
        date: [
            { key: "years", regex: /vor (\d+)\s*(Jahren|Jahr|Jhr\.)/ },
            { key: "months", regex: /vor (\d+)\s*(Monaten|Monat|Mon\.)/ },
            { key: "weeks", regex: /vor (\d+)\s*(Wochen|Woche|Wo\.)/ },
            { key: "days", regex: /vor (\d+)\s*(Tagen|Tag|Tg\.)/ },
            { key: "hours", regex: /vor (\d+)\s*(Stunden|Stunde|Std\.)/ },
            { key: "minutes", regex: /vor (\d+)\s*(Minuten|Minute|Min\.)/ },
            // * Fixed-value regexes are case-insensitive: shortenText looks up the fixed
            //   value via trimmed+lowercased text, so "Heute"/"Yesterday" must match too.
            { key: "days", regex: /^gestern$/i },
            { key: "days", regex: /^heute$/i },
        ],
        adsText: [
            "YouTube Premium",
            "1 Monat für 0 €",
            "Inhalte nur für Mitglieder",
            "nur für Mitglieder",
            // * Live badge text since ~2026-10: "Nur für Kanalmitglieder" (renamed from
            // * "Mitglieder"). Grid-item hides are class-based (ytBadgeShapeCommerce, see
            // * ads-hide.ts) — this entry only feeds the SHELF text-match fallback (ads.ts).
            "nur für kanalmitglieder",
        ],
    },
    en: {
        // * Views: "1.1M views" AND "12 views" — number(+optional unit) + optional "views".
        //   ~ watch-page: bare number ("294,234") without "views" word — `(?:views)?` makes it optional.
        //   ! ANCHORED ^…$ (bug #3 fix) — see the de comment for the rationale.
        //   Unit accepts lowercase ("45k views" appears on some YT surfaces).
        views: { regex: /^\s*([\d.,]+)\s*(M|K|k|m)?\s*(?:views)?\s*$/u },
        viewsWord: "views",
        date: [
            // * ~ watch-page uses abbreviated forms: "15h ago" / "2d ago" / "1mo ago" / "1y ago".
            { key: "years", regex: /(\d+)\s*(years|year|y)\s*ago/ },
            { key: "months", regex: /(\d+)\s*(months|month|mo)\s*ago/ },
            { key: "weeks", regex: /(\d+)\s*(weeks|week|w)\s*ago/ },
            { key: "days", regex: /(\d+)\s*(days|day|d)\s*ago/ },
            { key: "hours", regex: /(\d+)\s*(hours|hour|h)\s*ago/ },
            { key: "minutes", regex: /(\d+)\s*(minutes|minute|m)\s*ago/ },
            { key: "days", regex: /^yesterday$/i },
            { key: "days", regex: /^today$/i },
        ],
        adsText: ["YouTube Premium", "1 month for 0", "Members only", "members only"],
    },
    // TODO[locale]: fr, es, da, nl — verify the YouTube UI strings in each language, then extend the map.
};

/** Fixed day-offset values for yesterday/today date regexes (no numeric capture group). */
export const DATE_FIXED_VALUES: Record<string, number> = {
    gestern: 1,
    heute: 0,
    yesterday: 1,
    today: 0,
};

/**
 * Detects the YouTube content locale from `document.documentElement.lang`.
 *
 * Falls back to "de" when the lang attribute is absent or the base language has no matching
 * pattern set. This is content-matching locale, separate from GUI i18n.
 *
 * @returns A locale key present in `LOCALE_PATTERNS` (currently "de" or "en").
 */
export function detectLocale(): string {
    const lang = document.documentElement.lang;
    if (!lang) return "de";
    const base = lang.split("-")[0];
    return LOCALE_PATTERNS[base] ? base : "de";
}
