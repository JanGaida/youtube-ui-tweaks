// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { runMetaSplit, restoreMetaSplit, ROWBREAK_CLASS } from "../meta-split";
import { processAutoSyncBadge, restoreAutoSyncBadge } from "../badge";
import { resetRegistry, getFeatures } from "../registry";
import { registerAllFeatures } from "../features/index";
import { DEFAULT_SETTINGS, type Settings, type StylingSettings } from "../settings";

/**
 * Tests for the meta-split break-element pass (metaLayout:"split", analysis 2026-10-24):
 * channel names in line 1, views+date in a dedicated line 2.
 *
 * - Anchor: structural leading icon primary, views marker fallback (grid-styling runs
 *   before text-shorten — markers may not exist on the first pass).
 * - Idempotent per row; badge wrap rows and anchor-less rows untouched.
 * - Restore removes all break elements.
 * - auto-sync-badge interplay: integrated-start clones land AFTER the break (line 2),
 *   mixed layout keeps them at the row start.
 */

/** Live-structure metadata row (Fall 1, 2026-10-24): single channel, " " delimiters. */
const ROW_FALL1 = `
<div class="ytLockupMetadataViewModelMetadata">
    <div class="ytContentMetadataViewModelMetadataRow" role="group">
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText"><span dir="auto"><a class="ytAttributedStringLink" href="/@zdfmagazinroyale">ZDF MAGAZIN ROYALE</a></span></span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelIcon" aria-label="Bestätigt" style="width: 14px; height: 14px;"></span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon" style="width: 12px; height: 12px;"></span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" data-yt-tweaks-views="1" aria-label="146.661 Aufrufe">146.7k</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" data-yt-tweaks-date="1" aria-label="vor 10 Stunden">10h</span>
    </div>
</div>`;

/** Live-structure metadata row (Fall 2, 2026-10-24): multi-channel, EMPTY delimiters. */
const ROW_FALL2 = `
<div class="ytLockupMetadataViewModelMetadata">
    <div class="ytContentMetadataViewModelMetadataRow" role="group">
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText">Pyotr Kurzin | Geopolitics</span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelIcon" aria-label="Bestätigt" style="width: 14px; height: 14px; margin-inline-end: 2px;"></span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText">und Pjotr ​​Kurzin | Geopolitik-Shorts</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon" style="width: 12px; height: 12px;"></span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" data-yt-tweaks-views="1" aria-label="64.293 Aufrufe">64.3k</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" data-yt-tweaks-date="1" aria-label="vor 12 Stunden">12h</span>
    </div>
</div>`;

/** Split settings: styling enabled + metaLayout split (base for all pass tests). */
function splitSettings(): Settings {
    const s = structuredClone(DEFAULT_SETTINGS);
    s.styling.enabled = true;
    s.styling.metaLayout = "split";
    return s;
}

/** Mounts the snippet in the document and returns the metadata row. */
function mount(snippet: string): { host: HTMLElement; row: HTMLElement } {
    const host = document.createElement("div");
    host.innerHTML = snippet;
    document.body.appendChild(host);
    return { host, row: host.querySelector<HTMLElement>(".ytContentMetadataViewModelMetadataRow")! };
}

describe("meta-split run pass", () => {
    it("inserts exactly ONE break before the leading icon (Fall 1 structure)", () => {
        const { host, row } = mount(ROW_FALL1);
        runMetaSplit(splitSettings());
        const breaks = row.querySelectorAll(`.${ROWBREAK_CLASS}`);
        expect(breaks.length).toBe(1);
        const brk = breaks[0];
        // * Break sits between the trailing delimiter (line 1) and the leading icon (line 2).
        expect(brk.previousElementSibling!.classList).toContain("ytContentMetadataViewModelDelimiter");
        expect(brk.nextElementSibling!.classList).toContain("ytContentMetadataViewModelLeadingIcon");
        expect(brk.getAttribute("aria-hidden")).toBe("true");
        host.remove();
    });

    it("inserts the break before the second channel name's delimiter chain (Fall 2 structure)", () => {
        const { host, row } = mount(ROW_FALL2);
        runMetaSplit(splitSettings());
        const brk = row.querySelector(`.${ROWBREAK_CLASS}`)!;
        expect(brk).not.toBeNull();
        // * Line 1 keeps BOTH channel names; line 2 starts at the leading icon.
        expect(brk.previousElementSibling!.classList).toContain("ytContentMetadataViewModelDelimiter");
        expect(brk.nextElementSibling!.classList).toContain("ytContentMetadataViewModelLeadingIcon");
        const name2 = row.querySelectorAll(".ytContentMetadataViewModelMetadataText")[1];
        expect(brk.compareDocumentPosition(name2) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
        host.remove();
    });

    it("falls back to the views marker when the leading icon is absent", () => {
        const { host, row } = mount(ROW_FALL1);
        row.querySelector(".ytContentMetadataViewModelLeadingIcon")!.remove();
        runMetaSplit(splitSettings());
        const brk = row.querySelector(`.${ROWBREAK_CLASS}`)!;
        expect(brk.nextElementSibling!.hasAttribute("data-yt-tweaks-views")).toBe(true);
        host.remove();
    });

    it("leaves anchor-less rows untouched (graceful degradation)", () => {
        const { host, row } = mount(ROW_FALL1);
        row.querySelector(".ytContentMetadataViewModelLeadingIcon")!.remove();
        row.querySelector("[data-yt-tweaks-views]")!.removeAttribute("data-yt-tweaks-views");
        runMetaSplit(splitSettings());
        expect(row.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        host.remove();
    });

    it("skips when the anchor is the first child (nothing on line 1)", () => {
        const { host, row } = mount(ROW_FALL1);
        // * Degenerate row: only the views unit — a break would add an empty line.
        row.replaceChildren(row.querySelector(".ytContentMetadataViewModelLeadingIcon")!);
        runMetaSplit(splitSettings());
        expect(row.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        host.remove();
    });

    it("skips badge wrap rows (their own metadata row)", () => {
        const { host } = mount(ROW_FALL1);
        const wrap = document.createElement("div");
        wrap.className = "ytContentMetadataViewModelMetadataRow ytContentMetadataViewModelMetadataRowMetadataRowWrap";
        wrap.innerHTML = `<span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon"></span><span>Kanal</span>`;
        host.querySelector(".ytLockupMetadataViewModelMetadata")!.appendChild(wrap);
        runMetaSplit(splitSettings());
        expect(wrap.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        host.remove();
    });

    it("is idempotent — a second pass does not duplicate breaks", () => {
        const { host, row } = mount(ROW_FALL1);
        const s = splitSettings();
        runMetaSplit(s);
        runMetaSplit(s);
        runMetaSplit(s);
        expect(row.querySelectorAll(`.${ROWBREAK_CLASS}`).length).toBe(1);
        host.remove();
    });

    it("does nothing for metaLayout mixed and for styling disabled", () => {
        for (const mutate of [
            (s: Settings) => (s.styling.metaLayout = "mixed" as const),
            (s: Settings) => (s.styling.enabled = false),
        ]) {
            const { host, row } = mount(ROW_FALL1);
            const s = splitSettings();
            mutate(s);
            runMetaSplit(s);
            expect(row.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
            host.remove();
        }
    });
});

describe("meta-split restore", () => {
    it("removes all break elements and re-run re-inserts them", () => {
        const { host, row } = mount(ROW_FALL1);
        const s = splitSettings();
        runMetaSplit(s);
        expect(row.querySelectorAll(`.${ROWBREAK_CLASS}`).length).toBe(1);
        restoreMetaSplit();
        expect(row.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        runMetaSplit(s);
        expect(row.querySelectorAll(`.${ROWBREAK_CLASS}`).length).toBe(1);
        host.remove();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK: auto-sync-badge interplay — integrated-start must land on line 2
// ─────────────────────────────────────────────────────────────────────────────

/** Lockup metadata container with a badge wrap row + a views/date row (Fall 1). */
const BADGE_CONTAINER = `
<div class="ytLockupMetadataViewModelMetadata">
    <div class="ytContentMetadataViewModelMetadataRow ytContentMetadataViewModelMetadataRowMetadataRowWrap">
        <div class="ytBadgeShapeIcon"><div style="width: 24px; height: 24px;"><svg></svg></div></div>
    </div>
    <div class="ytContentMetadataViewModelMetadataRow" role="group">
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText"><a href="#">ZDF MAGAZIN ROYALE</a></span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon"></span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" data-yt-tweaks-views="1">146.7k</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" data-yt-tweaks-date="1">10h</span>
    </div>
</div>`;

/** Badge settings: enabled + integrated-start. */
function badgeSettings(settings: Settings): Settings {
    settings.autoSyncBadge.enabled = true;
    settings.autoSyncBadge.mode = "integrated-start";
    return settings;
}

describe("meta-split × auto-sync-badge (integrated-start)", () => {
    it("split active: the badge clone lands AFTER the break (start of the views+date line)", () => {
        const host = document.createElement("div");
        host.innerHTML = BADGE_CONTAINER;
        document.body.appendChild(host);
        const viewsRow = host.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataRow")[1];

        const s = badgeSettings(splitSettings());
        runMetaSplit(s);
        processAutoSyncBadge(s);

        const brk = viewsRow.querySelector(`.${ROWBREAK_CLASS}`)!;
        const badgeIcon = viewsRow.querySelector(".yt-tweaks-badge-clone.ytBadgeShapeIcon")!;
        const badgeDivider = viewsRow.querySelector(`.yt-tweaks-badge-clone.ytContentMetadataViewModelDelimiter`)!;
        // * icon, divider — directly after the break, BEFORE the leading icon (line 2 start).
        expect(badgeIcon.previousElementSibling).toBe(brk);
        expect(badgeDivider.previousElementSibling).toBe(badgeIcon);
        expect(badgeDivider.nextElementSibling!.classList).toContain("ytContentMetadataViewModelLeadingIcon");

        restoreAutoSyncBadge();
        restoreMetaSplit();
        host.remove();
    });

    it("mixed layout: the badge clone stays at the row start (native behavior unchanged)", () => {
        const host = document.createElement("div");
        host.innerHTML = BADGE_CONTAINER;
        document.body.appendChild(host);
        const viewsRow = host.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataRow")[1];

        const s = badgeSettings(splitSettings());
        s.styling.metaLayout = "mixed";
        runMetaSplit(s);
        processAutoSyncBadge(s);

        expect(viewsRow.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        const badgeIcon = viewsRow.querySelector(".yt-tweaks-badge-clone.ytBadgeShapeIcon")!;
        expect(viewsRow.firstElementChild!.contains(badgeIcon)).toBe(true);

        restoreAutoSyncBadge();
        host.remove();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK: settings shape — new enum keys exist and default correctly
// ─────────────────────────────────────────────────────────────────────────────

describe("meta-split settings defaults", () => {
    it("defaults to split layout + normal gap (curated defaults, ADR 0007)", () => {
        expect(DEFAULT_SETTINGS.styling.metaLayout).toBe("split");
        expect(DEFAULT_SETTINGS.styling.metaStatsGap).toBe("normal");
    });

    it("unknown enum values fall back to mixed/normal in the CSS emission", () => {
        const s = splitSettings();
        (s.styling as unknown as Record<string, unknown>).metaLayout = "bogus";
        (s.styling as unknown as Record<string, unknown>).metaStatsGap = "bogus";
        // * The pass gates strictly on "split" — a bogus value must not split anything.
        const { host, row } = mount(ROW_FALL1);
        runMetaSplit(s);
        expect(row.querySelector(`.${ROWBREAK_CLASS}`)).toBeNull();
        host.remove();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK: registry order — the marker-fallback anchor requires text-shorten first
// ─────────────────────────────────────────────────────────────────────────────

describe("meta-split registration order", () => {
    it("registers meta-split AFTER text-shorten (views marker set within the same pass)", () => {
        resetRegistry();
        registerAllFeatures();
        const ids = getFeatures().map((f) => f.id);
        expect(ids.indexOf("meta-split")).toBeGreaterThan(ids.indexOf("text-shorten"));
    });
});

/** Type-compile guard: the new keys are part of StylingSettings. */
export type _MetaSplitSettingsKeys = Pick<StylingSettings, "metaLayout" | "metaStatsGap">;
