// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { watchPageFeature, restoreWatchPage } from "../features/watch-page";
import type { PageCtx } from "../page";
import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";

/**
 * Tests for the watch-page feature — CSS rule generation + description click-fold
 * document-delegation (jsdom).
 *
 * * DOM-Fixture: none — the description box DOM is built inline per test (minimal: just
 *   the selectors the feature reads: `ytd-watch-metadata #description`,
 *   `#description-inline-expander[is-expanded]`, `tp-yt-paper-button#expand`/`#collapse`).
 *   Selector correctness against real YouTube DOM is covered by manual verification
 *   (user-provided ytd-watch-metadata HTML, 2026-08-27).
 *
 * ~ DECISION-LOG: click-fold uses a single capture listener delegated on `document`
 *   (re-render-immune), not a per-`#description` marker listener (lost on Polymer re-render).
 *   State detection via `#description-inline-expander[is-expanded]`.
 */
describe("watch-page feature", () => {
    let settings: Settings;
    let ctx: PageCtx;

    beforeEach(() => {
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.watchPage.enabled = true;
        settings.watchPage.descriptionClickFold = true;
        ctx = { page: "watch", locale: "de", settings };
        // * Ensure a clean DOM + no leftover document listener between tests.
        restoreWatchPage();
        document.body.innerHTML = "";
    });

    /**
     * Builds a watch-page description box fixture with the given expand state.
     *
     * @param expanded - true → expanded (`is-expanded` on the expander, #collapse visible);
     *                   false → collapsed (#expand visible, no `is-expanded`).
     * @returns the #description element.
     */
    function buildDescription(expanded: boolean): HTMLElement {
        document.body.innerHTML = `
            <ytd-watch-metadata ${expanded ? "" : "description-collapsed"}>
                <div id="description">
                    <div id="description-inner">
                        <ytd-text-inline-expander id="description-inline-expander" ${expanded ? 'is-expanded=""' : ""}>
                            <tp-yt-paper-button id="expand" ${expanded ? 'hidden=""' : ""}>...mehr</tp-yt-paper-button>
                            <tp-yt-paper-button id="collapse" ${expanded ? "" : 'hidden=""'}>Weniger anzeigen</tp-yt-paper-button>
                        </ytd-text-inline-expander>
                    </div>
                </div>
            </ytd-watch-metadata>`;
        return document.querySelector("#description") as HTMLElement;
    }

    describe("CSS: descriptionClickFold hover rule", () => {
        it("emits the theme-color hover rule for the expanded box when enabled", () => {
            const slice = settings.watchPage as unknown;
            const rules = watchPageFeature.pages.watch!.css!(slice, ctx);
            const hoverRule = rules.find((r) =>
                r.includes("ytd-watch-metadata:not([description-collapsed]) #description:hover"),
            );
            expect(hoverRule).toBeDefined();
            // * Reuses YT's own ambient/theme color custom property (not an opacity hack).
            expect(hoverRule).toContain("--yt-saturated-raised-background");
            expect(hoverRule).toContain("!important");
        });

        it("does NOT emit the old yt-interaction opacity:1 overlay rules", () => {
            const slice = settings.watchPage as unknown;
            const rules = watchPageFeature.pages.watch!.css!(slice, ctx);
            const joined = rules.join("\n");
            expect(joined).not.toContain("yt-interaction");
            expect(joined).not.toContain("opacity: 1");
        });

        it("emits no hover rule when descriptionClickFold is disabled", () => {
            settings.watchPage.descriptionClickFold = false;
            const slice = settings.watchPage as unknown;
            const rules = watchPageFeature.pages.watch!.css!(slice, ctx);
            expect(rules.some((r) => r.includes("#description:hover"))).toBe(false);
        });

        it("emits no rules at all when the feature is disabled", () => {
            settings.watchPage.enabled = false;
            const slice = settings.watchPage as unknown;
            const rules = watchPageFeature.pages.watch!.css!(slice, ctx);
            expect(rules).toEqual([]);
        });
    });

    describe("JS: description click-fold (document delegation)", () => {
        it("installs a single document-level capture click listener on run", () => {
            const addSpy = vi.spyOn(document, "addEventListener");
            watchPageFeature.pages.watch!.run!(ctx);
            // * Exactly one capture click listener on document (delegation).
            const clickCalls = addSpy.mock.calls.filter((c) => c[0] === "click" && c[2] === true);
            expect(clickCalls).toHaveLength(1);
            addSpy.mockRestore();
        });

        it("is idempotent — a second run does not add a second listener", () => {
            const addSpy = vi.spyOn(document, "addEventListener");
            watchPageFeature.pages.watch!.run!(ctx);
            watchPageFeature.pages.watch!.run!(ctx);
            const clickCalls = addSpy.mock.calls.filter((c) => c[0] === "click" && c[2] === true);
            expect(clickCalls).toHaveLength(1);
            addSpy.mockRestore();
        });

        it("taps #expand when the description is collapsed (background click)", async () => {
            buildDescription(false);
            const desc = document.querySelector("#description") as HTMLElement;
            const expand = document.querySelector("tp-yt-paper-button#expand") as HTMLElement;
            const tapSpy = vi.spyOn(expand, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            // * Simulate a background click (a plain div inside #description, not a button/link).
            const bg = document.createElement("div");
            desc.querySelector("#description-inner")!.appendChild(bg);
            bg.click();
            // * The synthetic gesture is deferred via setTimeout(0) out of the real click's
            //   processing (re-entrant dispatch would starve Polymer's gesture recognizer).
            await new Promise((r) => setTimeout(r, 10));
            // * pointerdown, pointerup, click dispatched on #expand (synthetic gesture).
            expect(tapSpy).toHaveBeenCalled();
            const types = tapSpy.mock.calls.map((c) => (c[0] as Event).type);
            expect(types).toEqual(["pointerdown", "pointerup", "click"]);
            tapSpy.mockRestore();
        });

        it("taps #collapse when the description is expanded (background click)", async () => {
            buildDescription(true);
            const desc = document.querySelector("#description") as HTMLElement;
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            const bg = document.createElement("div");
            desc.querySelector("#description-inner")!.appendChild(bg);
            bg.click();
            // * Deferred tap — wait for the setTimeout(0) to flush.
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).toHaveBeenCalled();
            const types = tapSpy.mock.calls.map((c) => (c[0] as Event).type);
            expect(types).toEqual(["pointerdown", "pointerup", "click"]);
            tapSpy.mockRestore();
        });

        it("ignores clicks on links and buttons inside the description", async () => {
            buildDescription(true);
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            // * Click an anchor inside the description.
            const link = document.createElement("a");
            link.href = "https://example.com";
            link.textContent = "link";
            document.querySelector("#description-inner")!.appendChild(link);
            link.click();
            // * Even after the deferred flush, no tap (links/buttons excluded).
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).not.toHaveBeenCalled();
            tapSpy.mockRestore();
        });

        it("ignores clicks outside any description box", async () => {
            buildDescription(true);
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            // * Click somewhere outside #description.
            const outside = document.createElement("div");
            outside.id = "not-the-description";
            document.body.appendChild(outside);
            outside.click();
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).not.toHaveBeenCalled();
            tapSpy.mockRestore();
        });

        it("ignores clicks that finalize a text selection (drag-select copy bug)", async () => {
            buildDescription(true);
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            const bg = document.createElement("div");
            bg.textContent = "selected description text";
            document.querySelector("#description-inner")!.appendChild(bg);
            // * Simulate a drag-select: window.getSelection() is non-collapsed when the
            //   click fires after mouseup (jsdom: add a real Range to the default selection).
            const sel = window.getSelection()!;
            sel.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(bg);
            sel.addRange(range);
            bg.click();
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).not.toHaveBeenCalled();
            sel.removeAllRanges();
            tapSpy.mockRestore();
        });

        it("ignores double clicks (word selection, detail >= 2)", async () => {
            buildDescription(true);
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            watchPageFeature.pages.watch!.run!(ctx);
            const bg = document.createElement("div");
            document.querySelector("#description-inner")!.appendChild(bg);
            bg.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 2 }));
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).not.toHaveBeenCalled();
            tapSpy.mockRestore();
        });

        it("does not install a listener when descriptionClickFold is disabled", () => {
            settings.watchPage.descriptionClickFold = false;
            const addSpy = vi.spyOn(document, "addEventListener");
            watchPageFeature.pages.watch!.run!(ctx);
            const clickCalls = addSpy.mock.calls.filter((c) => c[0] === "click" && c[2] === true);
            expect(clickCalls).toHaveLength(0);
            addSpy.mockRestore();
        });

        it("survives a Polymer-style re-render of #description (delegation re-render-immunity)", async () => {
            buildDescription(false);
            watchPageFeature.pages.watch!.run!(ctx);
            // * Simulate Polymer replacing #description-inner's children (marker/attr gone, but
            //   the document-delegated listener must still catch clicks on the new content).
            const meta = document.querySelector("ytd-watch-metadata") as HTMLElement;
            meta.innerHTML = `
                <div id="description">
                    <div id="description-inner">
                        <ytd-text-inline-expander id="description-inline-expander" is-expanded="">
                            <tp-yt-paper-button id="expand" hidden="">...mehr</tp-yt-paper-button>
                            <tp-yt-paper-button id="collapse">Weniger anzeigen</tp-yt-paper-button>
                        </ytd-text-inline-expander>
                    </div>
                </div>`;
            const newCollapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            const tapSpy = vi.spyOn(newCollapse, "dispatchEvent");
            const bg = document.createElement("div");
            document.querySelector("#description-inner")!.appendChild(bg);
            bg.click();
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).toHaveBeenCalled();
            tapSpy.mockRestore();
        });

        it("restore removes the document click listener", () => {
            const removeSpy = vi.spyOn(document, "removeEventListener");
            watchPageFeature.pages.watch!.run!(ctx);
            restoreWatchPage();
            const clickCalls = removeSpy.mock.calls.filter((c) => c[0] === "click" && c[2] === true);
            expect(clickCalls).toHaveLength(1);
            removeSpy.mockRestore();
        });

        it("restore makes subsequent background clicks no-op", async () => {
            buildDescription(true);
            const collapse = document.querySelector("tp-yt-paper-button#collapse") as HTMLElement;
            watchPageFeature.pages.watch!.run!(ctx);
            restoreWatchPage();
            const tapSpy = vi.spyOn(collapse, "dispatchEvent");
            const bg = document.createElement("div");
            document.querySelector("#description-inner")!.appendChild(bg);
            bg.click();
            await new Promise((r) => setTimeout(r, 10));
            expect(tapSpy).not.toHaveBeenCalled();
            tapSpy.mockRestore();
        });
    });

    describe("JS: share/save hide (regression — unchanged)", () => {
        it("marks a Share button by aria-label when shareButton=verstecken (locale de)", () => {
            settings.watchPage.shareButton = "verstecken";
            document.body.innerHTML = `
                <ytd-watch-metadata>
                    <div id="actions">
                        <div id="top-level-buttons-computed">
                            <yt-button-view-model>
                                <button aria-label="Teilen">Teilen</button>
                            </yt-button-view-model>
                        </div>
                    </div>
                </ytd-watch-metadata>`;
            watchPageFeature.pages.watch!.run!(ctx);
            const vm = document.querySelector("yt-button-view-model") as HTMLElement;
            expect(vm.hasAttribute("data-yt-tweaks-watch-hidden")).toBe(true);
        });
    });

    describe("feature metadata", () => {
        it("declares the expected liveApplyKeys", () => {
            expect(watchPageFeature.liveApplyKeys).toContain("watchPage.descriptionClickFold");
            expect(watchPageFeature.liveApplyKeys).toContain("watchPage.enabled");
        });

        it("is scoped to the watch page only", () => {
            expect(Object.keys(watchPageFeature.pages)).toEqual(["watch"]);
        });
    });
});
