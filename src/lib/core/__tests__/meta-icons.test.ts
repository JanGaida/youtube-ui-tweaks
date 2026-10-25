// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { metaIconsCss, ICON_GAP_EM, ICON_BASELINE_SHIFT_EM } from "../features/meta-icons";
import { textShortenFeature } from "../features/text-shorten";
import { shortenText, restoreText, runTextShorten } from "../text";
import { DEFAULT_SETTINGS, type Settings, type TextShortenSettings } from "../settings";

/**
 * Tests for the text-shorten hardening additions (ADR 0006):
 *
 * 1. viewsWordMode — "none" strips the word (number only), "locale" appends the locale's
 *    native word (de "Aufrufe", en "views").
 * 2. Meta-icons CSS — eye before views, clock before date, gated on shortenViews/shortenDate
 *    + icon flags; native leading icon hidden when the views icon is active.
 */

function settingsWith(overrides: Partial<TextShortenSettings>): Settings {
    const s = structuredClone(DEFAULT_SETTINGS) as Settings;
    s.textShorten = { ...s.textShorten, ...overrides };
    return s;
}

describe("viewsWordMode", () => {
    it('mode "none" formats the number without a word', () => {
        const el = document.createElement("span");
        el.textContent = "8,2 Mio. Aufrufe";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "none" }), "de");
        expect(el.textContent).toBe("8,2M");
    });

    it('mode "locale" appends the locale word (de "Aufrufe")', () => {
        const el = document.createElement("span");
        el.textContent = "8,2 Mio. Aufrufe";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "locale" }), "de");
        expect(el.textContent).toBe("8,2M Aufrufe");
    });

    it('mode "locale" appends the locale word (en "views")', () => {
        const el = document.createElement("span");
        // * en grid format with YT-supplied K unit: "12K views" → "12k views" (unit word appended).
        el.textContent = "12K views";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "locale" }), "en");
        expect(el.textContent).toBe("12k views");
    });

    it("en: dot-decimal + M unit parses correctly (locale-aware number parsing)", () => {
        const el = document.createElement("span");
        // * Former gap (fixed with locale-aware parsing): "1.5M views" misparsed as "15M".
        el.textContent = "1.5M views";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "none" }), "en");
        expect(el.textContent).toBe("1.5M");
    });

    it("en: bare comma-grouped number parses as thousands-grouping", () => {
        const el = document.createElement("span");
        // * Former gap (fixed with locale-aware parsing): "294,234" parsed as 294.234 (< 1k, unchanged).
        el.textContent = "294,234 views";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "none" }), "en");
        expect(el.textContent).toBe("294.2k");
    });

    it("default settings use viewsWordMode none (number only)", () => {
        const el = document.createElement("span");
        el.textContent = "450.552 Aufrufe";
        shortenText(el, DEFAULT_SETTINGS, "de");
        expect(el.textContent).toBe("450,6k");
    });

    it("date texts are never touched by the views pass (bug #3: anchored regex)", () => {
        const el = document.createElement("span");
        el.textContent = "vor 17 Std.";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "locale", shortenDate: false }), "de");
        // * The anchored views regex must NOT match the bare "17" inside a date text —
        //   the old unanchored pattern produced "vor 17 AufrufeStd.".
        expect(el.textContent).toBe("vor 17 Std.");
    });

    it("channel names are never rewritten by the views pass (no numbers to match)", () => {
        const el = document.createElement("span");
        el.textContent = "Pixel Makers";
        shortenText(el, settingsWith({ shortenViews: true, viewsWordMode: "locale" }), "de");
        expect(el.textContent).toBe("Pixel Makers");
    });
});

describe("meta-icons CSS", () => {
    const slice = (overrides: Partial<TextShortenSettings>): TextShortenSettings => ({
        ...structuredClone(DEFAULT_SETTINGS.textShorten),
        ...overrides,
    });

    it("emits nothing when both icons are off", () => {
        expect(metaIconsCss(slice({ icons: { viewsIcon: false, dateIcon: false, sizeEm: 0.9 } }))).toEqual([]);
    });

    it("emits exactly the views rule + native-icon hide when viewsIcon is on", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, icons: { viewsIcon: true, dateIcon: false, sizeEm: 0.9 } }),
        );
        expect(css).toHaveLength(2);
        // * Views rule: selects the CLASSIFICATION MARKER the text pass sets on actually-matched
        //   views texts (bug #11 fix — structural selectors painted eyes on channel names in
        //   live mixed rows). The marker is the only selector.
        expect(css[0]).toMatch(/^\[data-yt-tweaks-views\]::before \{ /);
        // * D3 displacement: native leading icon hidden while our icon is active.
        expect(css[1]).toContain(".ytContentMetadataViewModelLeadingIcon");
        expect(css[1]).toContain("display: none !important");
    });

    it("emits exactly the date rule when dateIcon is on", () => {
        const css = metaIconsCss(
            slice({ shortenDate: true, icons: { viewsIcon: false, dateIcon: true, sizeEm: 0.9 } }),
        );
        expect(css).toHaveLength(1);
        expect(css[0]).toMatch(/^\[data-yt-tweaks-date\]::before \{ /);
    });

    it("emits both icon rules (3 rules incl. native hide) when both are on", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, shortenDate: true, icons: { viewsIcon: true, dateIcon: true, sizeEm: 1 } }),
        );
        expect(css).toHaveLength(3);
    });

    it("views icon is gated on shortenViews (feature super-switch wins)", () => {
        const css = metaIconsCss(
            slice({ shortenViews: false, icons: { viewsIcon: true, dateIcon: false, sizeEm: 0.9 } }),
        );
        expect(css).toEqual([]);
    });

    it("date icon is gated on shortenDate (feature super-switch wins)", () => {
        const css = metaIconsCss(
            slice({ shortenDate: false, icons: { viewsIcon: false, dateIcon: true, sizeEm: 0.9 } }),
        );
        expect(css).toEqual([]);
    });

    it("icon rules use currentColor tinting + mask-image (theme-safe, no hardcoded color)", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, icons: { viewsIcon: true, dateIcon: true, sizeEm: 0.9 } }),
        );
        for (const rule of css.filter((r) => r.includes("::before"))) {
            expect(rule).toContain("background-color: currentColor");
            expect(rule).toContain("mask-image: url");
            expect(rule).toContain("-webkit-mask-image: url");
        }
    });

    it("icon size comes from settings (sizeEm in width/height)", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, icons: { viewsIcon: true, dateIcon: false, sizeEm: 1.2 } }),
        );
        expect(css[0]).toContain("width: 1.2em");
        expect(css[0]).toContain("height: 1.2em");
    });

    it("alignment constants are applied (gap + baseline shift)", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, icons: { viewsIcon: true, dateIcon: false, sizeEm: 0.9 } }),
        );
        expect(css[0]).toContain(`margin-right: ${ICON_GAP_EM}em`);
        expect(css[0]).toContain(`transform: translateY(${ICON_BASELINE_SHIFT_EM}em)`);
    });

    it("feature css hook aggregates meta-icons on all 5 pages", () => {
        const s = slice({ shortenViews: true, icons: { viewsIcon: true, dateIcon: true, sizeEm: 0.9 } });
        for (const page of ["home", "subscriptions", "channel", "search", "watch"] as const) {
            const css = textShortenFeature.pages[page]!.css!(s, undefined as never);
            expect(css).toHaveLength(3);
        }
    });

    it("views + date rules select classification markers only (no structural selectors)", () => {
        const css = metaIconsCss(
            slice({ shortenViews: true, shortenDate: true, icons: { viewsIcon: true, dateIcon: true, sizeEm: 0.9 } }),
        );
        for (const rule of css.filter((r) => r.includes("::before"))) {
            // * Marker-only selectors — immune to YT's row-structure du jour (bug #11).
            expect(rule).toMatch(/^\[data-yt-tweaks-(views|date)\]::before \{ /);
            expect(rule).not.toContain("MetadataRow");
            expect(rule).not.toContain("MetadataText");
            expect(rule).not.toContain(":has(");
        }
    });
});

describe("classification markers (bug #11 — regex-driven, never structural)", () => {
    it("views marker is set ONLY on texts the views regex actually matched", () => {
        const el = document.createElement("span");
        el.textContent = "62.345";
        shortenText(el, settingsWith({ shortenViews: true }), "de");
        expect(el.getAttribute("data-yt-tweaks-views")).toBe("1");
    });

    it("plain channel-name texts get NO views marker (live mixed rows — bug #11 repro)", () => {
        // * Live structure: ONE row mixes "Aurora", "und Nova Streams", "62.345", "11D".
        //   (Channel names replaced with synthetic ones before publishing — the structure,
        //   not the real names, is what makes this repro work.) The names are plain texts
        //   without links — structural scoping failed live. The regex classifier must
        //   reject them.
        const el = document.createElement("span");
        el.textContent = "und Nova Streams";
        shortenText(el, settingsWith({ shortenViews: true, shortenDate: true }), "de");
        expect(el.hasAttribute("data-yt-tweaks-views")).toBe(false);
        expect(el.hasAttribute("data-yt-tweaks-date")).toBe(false);
    });

    it("date texts get the date marker (not the views marker)", () => {
        const el = document.createElement("span");
        el.textContent = "vor 11 Tagen";
        shortenText(el, settingsWith({ shortenViews: true, shortenDate: true }), "de");
        expect(el.hasAttribute("data-yt-tweaks-date")).toBe(true);
        expect(el.hasAttribute("data-yt-tweaks-views")).toBe(false);
    });

    it("bare views numbers (watch sidebar format) get the views marker", () => {
        const el = document.createElement("span");
        el.textContent = "293.706";
        shortenText(el, settingsWith({ shortenViews: true, shortenDate: false }), "de");
        expect(el.getAttribute("data-yt-tweaks-views")).toBe("1");
    });

    it("LIVE mixed row (bug #11 repro): only the views number gets the eye, names stay clean", () => {
        // * Exact live structure from the user report (names anonymized): ONE metadata row
        //   mixes channel names (plain text, no link), views number, and date. Build it,
        //   run the real pass over the row, assert the marker distribution.
        const row = document.createElement("div");
        row.className = "ytContentMetadataViewModelMetadataRow";
        row.innerHTML = [
            `<span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" role="text">Aurora</span>`,
            `<span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>`,
            `<span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" role="text">und Nova Streams</span>`,
            `<span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>`,
            `<span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon" style="width: 12px; height: 12px;"><svg></svg></span>`,
            `<span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" role="text" aria-label="62.345 Aufrufe">62.345</span>`,
            `<span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>`,
            `<span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text" aria-label="vor 11 Tagen">vor 11 Tagen</span>`,
        ].join("");
        document.body.appendChild(row);

        runTextShorten(settingsWith({ shortenViews: true, shortenDate: true }), "de");

        const texts = Array.from(row.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText"));
        const byText = (t: string) => texts.find((el) => el.dataset.ytTweakedOriginal === t);

        // * The views number (and only it) carries the views marker.
        expect(byText("62.345")!.hasAttribute("data-yt-tweaks-views")).toBe(true);
        // * The date carries the date marker (not the views marker).
        expect(byText("vor 11 Tagen")!.hasAttribute("data-yt-tweaks-date")).toBe(true);
        expect(byText("vor 11 Tagen")!.hasAttribute("data-yt-tweaks-views")).toBe(false);
        // * Channel names carry NEITHER marker — the old structural CSS painted the eye on them.
        expect(byText("Aurora")!.hasAttribute("data-yt-tweaks-views")).toBe(false);
        expect(byText("Aurora")!.hasAttribute("data-yt-tweaks-date")).toBe(false);
        expect(byText("und Nova Streams")!.hasAttribute("data-yt-tweaks-views")).toBe(false);
        expect(byText("und Nova Streams")!.hasAttribute("data-yt-tweaks-date")).toBe(false);
        row.remove();
    });

    it("no markers when the passes are disabled (icons are separately gated anyway)", () => {
        const el = document.createElement("span");
        el.textContent = "62.345";
        shortenText(el, settingsWith({ shortenViews: false, shortenDate: false }), "de");
        expect(el.hasAttribute("data-yt-tweaks-views")).toBe(false);
    });

    it("restoreText removes the classification markers too", () => {
        const el = document.createElement("span");
        el.textContent = "62.345";
        document.body.appendChild(el);
        shortenText(el, settingsWith({ shortenViews: true }), "de");
        expect(el.hasAttribute("data-yt-tweaks-views")).toBe(true);

        restoreText();
        expect(el.hasAttribute("data-yt-tweaks-views")).toBe(false);
        el.remove();
    });
});
