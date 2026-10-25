// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { dimWatchedFeature, restoreDimWatched } from "../features/dim-watched";
import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";

/**
 * Fixture test for the dim-watched progress quantization against a REAL captured YouTube
 * subscriptions-grid DOM (watched progress bars present, various percentages).
 *
 * The fixture contains `.ytThumbnailOverlayProgressBarHost` items with inline
 * `width: NN%` on the progress-bar segment (24%, 10%, 81%, 56%, 100% among many 100%s).
 * The DOM run pass must quantize those into the expected bucket markers (D1 downward
 * quantization) and skip items below the first step.
 *
 * * DOM-Fixture: __fixtures__/subscriptions-grid-item.fixture.html (captured 2026-08-23, de)
 *   Selector .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment → light DOM.
 *   Shadow-DOM boundary: none for these selectors.
 */

/** Sets dimWatched settings with the given progressSteps and runs the DOM pass. */
function runDim(settings: Settings): void {
    dimWatchedFeature.pages.home!.run!({ page: "home", locale: "de", settings } as never);
}

/** Collects the marker values of all grid items that have a progress overlay. */
function markerOfWatched(): Map<HTMLElement, string | null> {
    const map = new Map<HTMLElement, string | null>();
    document.querySelectorAll<HTMLElement>("ytd-rich-item-renderer").forEach((item) => {
        if (item.querySelector(".ytThumbnailOverlayProgressBarHost")) {
            map.set(item, item.getAttribute("data-yt-tweaks-dim"));
        }
    });
    return map;
}

/** Finds a watched item whose progress-bar segment has the given width percent. */
function itemWithProgress(pct: string): HTMLElement | undefined {
    return Array.from(document.querySelectorAll<HTMLElement>("ytd-rich-item-renderer")).find((item) => {
        const seg = item.querySelector<HTMLElement>(".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment");
        return seg?.style.width === pct;
    });
}

// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("subscriptions-grid-item"))("dim-watched progress quantization fixture", () => {
    it("fixture contains watched items with progress bars", () => {
        loadFixture("subscriptions-grid-item");
        expect(itemWithProgress("24%")).toBeDefined();
        expect(itemWithProgress("81%")).toBeDefined();
        expect(itemWithProgress("56%")).toBeDefined();
    });

    it("steps=off marks every watched item dimmed-100 (legacy full veil)", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = true;
        settings.dimWatched.progressSteps = "off";
        runDim(settings);

        for (const marker of markerOfWatched().values()) {
            expect(marker).toBe("dimmed-100");
        }
    });

    it("steps=quarter quantizes 24%/10% → skip, 56% → dimmed-50, 81% → dimmed-75, 100% → dimmed-100", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = true;
        settings.dimWatched.progressSteps = "quarter";
        runDim(settings);

        // * Below the first step (25%) — no veil.
        expect(itemWithProgress("24%")!.getAttribute("data-yt-tweaks-dim")).toBe("skip");
        expect(itemWithProgress("10%")!.getAttribute("data-yt-tweaks-dim")).toBe("skip");
        // * 56% floors into the 50 bucket, 81% into 75, 100% stays 100.
        expect(itemWithProgress("56%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-50");
        expect(itemWithProgress("81%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-75");
        expect(itemWithProgress("100%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-100");
    });

    it("steps=half quantizes 24%/56%/81% → dimmed-50 only for ≥50, 100% → dimmed-100", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = true;
        settings.dimWatched.progressSteps = "half";
        runDim(settings);

        expect(itemWithProgress("24%")!.getAttribute("data-yt-tweaks-dim")).toBe("skip");
        expect(itemWithProgress("56%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-50");
        expect(itemWithProgress("81%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-50");
        expect(itemWithProgress("100%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-100");
    });

    it("steps=third quantizes 24%/10% → skip, 56% → dimmed-33, 81% → dimmed-66", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = true;
        settings.dimWatched.progressSteps = "third";
        runDim(settings);

        expect(itemWithProgress("24%")!.getAttribute("data-yt-tweaks-dim")).toBe("skip");
        expect(itemWithProgress("10%")!.getAttribute("data-yt-tweaks-dim")).toBe("skip");
        expect(itemWithProgress("56%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-33");
        expect(itemWithProgress("81%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-66");
        expect(itemWithProgress("100%")!.getAttribute("data-yt-tweaks-dim")).toBe("dimmed-100");
    });

    it("DOM pass is idempotent (marker set once, re-run does not re-evaluate)", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = true;
        settings.dimWatched.progressSteps = "quarter";
        runDim(settings);
        const first = itemWithProgress("56%")!.getAttribute("data-yt-tweaks-dim");

        // * Second run without restore — markers unchanged (idempotent via marker attribute).
        runDim(settings);
        expect(itemWithProgress("56%")!.getAttribute("data-yt-tweaks-dim")).toBe(first);
    });

    it("no-op when disabled (no markers set)", () => {
        loadFixture("subscriptions-grid-item");
        restoreDimWatched();
        const settings = structuredClone(DEFAULT_SETTINGS) as Settings;
        settings.dimWatched.enabled = false;
        runDim(settings);

        for (const marker of markerOfWatched().values()) {
            expect(marker).toBeNull();
        }
    });
});
