import type { TextShortenSettings } from "../settings";
import { VIEWS_MARKER, DATE_MARKER } from "../text";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: meta-icons — eye (views) + clock (date) ::before icons (marker-driven CSS)
// ─────────────────────────────────────────────────────────────────────────────
// * Emits CSS that renders a leading icon in front of the views number (eye) and the date
//   text (clock) inside grid-item metadata rows. Consumed by the text-shorten feature
//   (same pages, same settings slice) — no DOM pass of its own.
//
// * Icon technique: mask-image with an inline SVG data-URI + background-color: currentColor.
//   currentColor inherits the meta text color → dark + light theme safe without duplication.
//
// * Row targeting (bug #11 fix — classification markers over structural selectors): live
//   DOM rows mix channel names + views + date in ONE metadata row, channel names can be plain
//   text without <a> — every structural guess (delimiter scope, LastPart, link exclusion)
//   painted icons on channel names. The text pass (text.ts) is the ONLY reliable classifier:
//   it matches the anchored views/date regexes and sets `data-yt-tweaks-views` /
//   `data-yt-tweaks-date` ONLY on actually-matched texts. The CSS selects those markers —
//   it cannot miss or over-match, regardless of YT's row structure du jour.
//
// * Native leading icon replacement (D3): YouTube renders its own leading icon in the
//   views row on some surfaces (watch sidebar: .ytContentMetadataViewModelLeadingIcon with a
//   play SVG). When our views icon is active, the native icon is hidden (displaced) so the
//   two never stack.

// ─── Tunable constants (POC-verified alignment — adjust here, not in the rules) ───

/** Gap between the icon and the following text (relative to the meta font-size). */
export const ICON_GAP_EM = 0.25;
/** Vertical alignment correction against the text baseline (em). */
export const ICON_BASELINE_SHIFT_EM = 0.12;

// ─── SVG paths (Material Symbols: visibility + schedule, 24×24 viewBox) ───

/** Material Symbols "visibility" (eye) path — views count icon. */
const EYE_SVG_PATH =
    "M12 5c-5.16 0-9.44 3.21-11 7.5C2.56 16.79 6.84 20 12 20s9.44-3.21 11-7.5C21.44 8.21 17.16 5 12 5Zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3Z";

/** Material Symbols "schedule" (clock) path — upload date icon. */
const CLOCK_SVG_PATH =
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z";

/** Builds a mask-compatible SVG data-URI for the given path. */
function svgDataUri(path: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Shared ::before box declarations — mask sized via the configured em, tinted currentColor. */
function iconBox(dataUri: string, sizeEm: number): string {
    return [
        'content: "" !important',
        "display: inline-block !important",
        "vertical-align: baseline !important",
        `width: ${sizeEm}em !important`,
        `height: ${sizeEm}em !important`,
        `margin-right: ${ICON_GAP_EM}em !important`,
        `transform: translateY(${ICON_BASELINE_SHIFT_EM}em) !important`,
        "flex-shrink: 0 !important",
        "background-color: currentColor !important",
        `-webkit-mask-image: ${dataUri} !important`,
        `mask-image: ${dataUri} !important`,
        "-webkit-mask-repeat: no-repeat !important",
        "mask-repeat: no-repeat !important",
        "-webkit-mask-position: center !important",
        "mask-position: center !important",
        "-webkit-mask-size: contain !important",
        "mask-size: contain !important",
    ].join("; ");
}

/**
 * Builds the meta-icon CSS rules from the text-shorten slice.
 *
 * Emits nothing unless the respective gate (shortenViews/shortenDate + icon flag) is on.
 *
 * @param slice - The textShorten settings slice.
 * @returns CSS rule strings.
 */
export function metaIconsCss(slice: unknown): string[] {
    const s = slice as TextShortenSettings;
    const rules: string[] = [];

    // * Views icon (eye) — ONLY on texts the text pass classified as views (marker attribute).
    if (s.shortenViews && s.icons.viewsIcon) {
        rules.push(`[${VIEWS_MARKER}]::before { ${iconBox(svgDataUri(EYE_SVG_PATH), s.icons.sizeEm)}; }`);
        // * D3 displacement: hide YouTube's native leading icon (play SVG) so the
        //   two icons never stack.
        rules.push(`.ytContentMetadataViewModelLeadingIcon { display: none !important; }`);
    }

    // * Date icon (clock) — ONLY on texts the text pass classified as date (marker attribute).
    if (s.shortenDate && s.icons.dateIcon) {
        rules.push(`[${DATE_MARKER}]::before { ${iconBox(svgDataUri(CLOCK_SVG_PATH), s.icons.sizeEm)}; }`);
    }

    return rules;
}
