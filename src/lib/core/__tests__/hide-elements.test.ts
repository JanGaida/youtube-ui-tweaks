// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { hideElementsFeature } from "../features/hide-elements";
import { DEFAULT_SETTINGS, type HideElementsSettings } from "../settings";

/**
 * Tests for the hide-elements feature (D7, bug #12 fix): verified-badge hide in grid-item
 * lockups.
 *
 * Pure-logic part: validation + CSS emission (gates, exact selector).
 *
 * ! The fixture-based selector tests were REMOVED: the captured fixture (2026-08-23) shows
 *   the checkmark INSIDE the channel-name link (ytAttributedStringInlineBlockMod) — the live
 *   DOM (2026-09-12, user-reported snippet) renders it as a SIBLING with
 *   `aria-label="Bestätigt"`. The aria-label is the live-verified anchor; the fixture
 *   structure is dead and would assert the wrong thing.
 *
 * The live-structure test below injects the user-reported DOM snippet and proves the
 * selector matches it exactly.
 */

const SELECTOR =
    '.ytLockupViewModelMetadata .ytContentMetadataViewModelIcon[aria-label="Bestätigt"], .ytLockupViewModelMetadata .ytContentMetadataViewModelIcon[aria-label="Verified"]';

/** Live DOM snippet as reported by the user (2026-09-12, home grid, de). */
const LIVE_ROW_SNIPPET = `
<yt-content-metadata-view-model class="ytContentMetadataViewModelHost ytContentMetadataViewModelMediumText">
    <div class="ytContentMetadataViewModelMetadataRow" role="group">
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" dir="auto">
            <span dir="auto"><a class="ytAttributedStringLink" href="/@sampleworks">sampleworks</a></span>
        </span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelIcon" aria-label="Bestätigt" style="width: 14px; height: 14px;">
            <svg xmlns="http://www.w3.org/2000/svg"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Z"></path></svg>
        </span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytIconWrapperHost ytContentMetadataViewModelLeadingIcon" style="width: 12px; height: 12px;">
            <svg xmlns="http://www.w3.org/2000/svg"><path d="M5 4.623v14.755"></path></svg>
        </span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" aria-label="293.706 Aufrufe" role="text">293.706</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> </span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" aria-label="vor 13 Stunden" role="text">vor 13 Std.</span>
    </div>
</yt-content-metadata-view-model>`;

describe("hide-elements validate", () => {
    it("accepts the default config", () => {
        const errors = hideElementsFeature.validate!(structuredClone(DEFAULT_SETTINGS.hideElements));
        expect(errors).toEqual([]);
    });

    it("rejects non-boolean enabled", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        (s as unknown as Record<string, unknown>).enabled = "yes";
        expect(hideElementsFeature.validate!(s).map((e) => e.path)).toContain("hideElements.enabled");
    });

    it("rejects non-boolean hideVerifiedBadge", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        (s as unknown as Record<string, unknown>).hideVerifiedBadge = 1;
        expect(hideElementsFeature.validate!(s).map((e) => e.path)).toContain("hideElements.hideVerifiedBadge");
    });
});

describe("hide-elements CSS output", () => {
    it("emits no CSS when the group is disabled", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        s.enabled = false;
        s.hideVerifiedBadge = true;
        expect(hideElementsFeature.pages.home!.css!(s, undefined as never)).toEqual([]);
    });

    it("emits no CSS when enabled but the flag is off", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        s.enabled = true;
        s.hideVerifiedBadge = false;
        expect(hideElementsFeature.pages.home!.css!(s, undefined as never)).toEqual([]);
    });

    it("emits the aria-label-anchored verified-badge hide rule when enabled + flag on", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        s.enabled = true;
        s.hideVerifiedBadge = true;
        const css = hideElementsFeature.pages.home!.css!(s, undefined as never);
        expect(css).toHaveLength(1);
        expect(css[0]).toContain(`${SELECTOR} { display: none !important; }`);
    });

    it("emits on all 5 lockup pages (home, subscriptions, channel, search, watch)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.hideElements) as HideElementsSettings;
        s.enabled = true;
        s.hideVerifiedBadge = true;
        for (const page of ["home", "subscriptions", "channel", "search", "watch"] as const) {
            const css = hideElementsFeature.pages[page]!.css!(s, undefined as never);
            expect(css).toHaveLength(1);
        }
    });
});

describe("hide-elements selector vs LIVE DOM (user-reported structure)", () => {
    it("matches the verified icon in the live snippet exactly (bug #12 repro)", () => {
        const host = document.createElement("div");
        host.className = "ytLockupViewModelMetadata";
        host.innerHTML = LIVE_ROW_SNIPPET;
        document.body.appendChild(host);

        // * Document-scope query (real stylesheet context — jsdom's element-scoped
        //   querySelectorAll does not treat the context element as an ancestor).
        const matches = document.querySelectorAll(SELECTOR);
        // * Exactly the checkmark span — the aria-label discriminates it from the play icon
        //   and every other icon in the row.
        expect(matches.length).toBe(1);
        expect(matches[0].getAttribute("aria-label")).toBe("Bestätigt");
        host.remove();
    });

    it("does NOT match the native play leading icon or channel link (no over-hide)", () => {
        const host = document.createElement("div");
        host.className = "ytLockupViewModelMetadata";
        host.innerHTML = LIVE_ROW_SNIPPET;
        document.body.appendChild(host);

        const play = host.querySelector<HTMLElement>(".ytContentMetadataViewModelLeadingIcon");
        expect(play).not.toBeNull();
        expect(play!.matches(SELECTOR)).toBe(false);

        const link = host.querySelector<HTMLElement>("a.ytAttributedStringLink");
        expect(link).not.toBeNull();
        expect(link!.matches(SELECTOR)).toBe(false);
        host.remove();
    });

    it("unlabeled icons are NOT hidden (music-note co-hide resolved — fails safe)", () => {
        const host = document.createElement("div");
        host.className = "ytLockupViewModelMetadata";
        host.innerHTML = LIVE_ROW_SNIPPET;
        // * Simulate the music-note variant: same slot, DIFFERENT aria-label.
        const note = host.querySelector<HTMLElement>(".ytContentMetadataViewModelIcon")!;
        note.setAttribute("aria-label", "");
        document.body.appendChild(host);

        expect(document.querySelectorAll(SELECTOR).length).toBe(0);
        host.remove();
    });

    it("the en label variant (Verified) is also covered (content-locale independence)", () => {
        const host = document.createElement("div");
        host.className = "ytLockupViewModelMetadata";
        host.innerHTML = LIVE_ROW_SNIPPET;
        const check = host.querySelector<HTMLElement>(".ytContentMetadataViewModelIcon")!;
        check.setAttribute("aria-label", "Verified");
        document.body.appendChild(host);

        expect(document.querySelectorAll(SELECTOR).length).toBe(1);
        host.remove();
    });
});
