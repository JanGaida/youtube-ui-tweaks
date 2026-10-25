// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { startpageGridFeature } from "../features/startpage-grid";
import { DEFAULT_SETTINGS, type StartpageSettings } from "../settings";
import type { PageCtx } from "../page";

/**
 * Tests for the startpage-grid feature: validator + CSS builder (pure logic) and the
 * inline JS run pass (jsdom).
 *
 * Validates `customColumns` integer-range enforcement and the CSS rule
 * generation for each preset (`default` / `"1"`–`"10"` / `custom`).
 * * File-level jsdom environment (documented position): the run tests need
 *   querySelector/style.setProperty; the pure-logic tests don't mind jsdom.
 */
const dummyCtx: PageCtx = { page: "home", locale: "de", settings: DEFAULT_SETTINGS };

function cloneStartpage(): StartpageSettings {
    return structuredClone(DEFAULT_SETTINGS.startpage) as StartpageSettings;
}

describe("startpage-grid validate", () => {
    it("accepts default settings (preset=default, customColumns=3)", () => {
        const errors = startpageGridFeature.validate!(cloneStartpage());
        expect(errors).toEqual([]);
    });

    it("accepts customColumns within [1,10] when preset=custom", () => {
        const s = cloneStartpage();
        s.columnsPreset = "custom";
        s.customColumns = 7;
        expect(startpageGridFeature.validate!(s)).toEqual([]);
    });

    it("rejects customColumns below 1 when preset=custom", () => {
        const s = cloneStartpage();
        s.columnsPreset = "custom";
        s.customColumns = 0;
        const errors = startpageGridFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("startpage.customColumns");
    });

    it("rejects customColumns above 10 when preset=custom", () => {
        const s = cloneStartpage();
        s.columnsPreset = "custom";
        s.customColumns = 99;
        const errors = startpageGridFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("startpage.customColumns");
    });

    it("rejects non-integer customColumns when preset=custom", () => {
        const s = cloneStartpage();
        s.columnsPreset = "custom";
        s.customColumns = 3.5;
        const errors = startpageGridFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("startpage.customColumns");
    });

    it("does NOT flag customColumns out of range when preset is not custom", () => {
        const s = cloneStartpage();
        s.columnsPreset = "2";
        s.customColumns = 999;
        expect(startpageGridFeature.validate!(s)).toEqual([]);
    });
});

describe("startpage-grid CSS", () => {
    const findGridVarRule = (css: string[]): string | undefined =>
        css.find((r) => r.includes("--ytd-rich-grid-items-per-row"));
    const findSkeletonRule = (css: string[]): string | undefined =>
        css.find((r) => r.includes("#home-container-media"));

    it("emits no rules when disabled", () => {
        const s = cloneStartpage();
        s.enabled = false;
        s.columnsPreset = "4";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(css).toEqual([]);
    });

    it("emits no rules for default preset (YT-native)", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "default";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(css).toEqual([]);
    });

    it("emits grid-var + skeleton rules for preset 2", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "2";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 2");
        expect(findSkeletonRule(css)).toContain("repeat(2, minmax(0, 1fr))");
    });

    it("emits grid-var + skeleton rules for preset 4", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "4";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 4");
        expect(findSkeletonRule(css)).toContain("repeat(4, minmax(0, 1fr))");
    });

    it("emits grid-var + skeleton rules for preset 5", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "5";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 5");
    });

    it("emits grid-var for the lower boundary preset 1", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "1";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 1");
        expect(findSkeletonRule(css)).toContain("repeat(1, minmax(0, 1fr))");
    });

    it("emits grid-var for the upper boundary preset 10", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "10";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 10");
        expect(findSkeletonRule(css)).toContain("repeat(10, minmax(0, 1fr))");
    });

    it("uses customColumns when preset=custom", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "custom";
        s.customColumns = 7;
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 7");
        expect(findSkeletonRule(css)).toContain("repeat(7, minmax(0, 1fr))");
    });

    it("clamps customColumns below 1 to 1 in the CSS", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "custom";
        s.customColumns = -5;
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 1");
    });

    it("clamps customColumns above 10 to 10 in the CSS", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "custom";
        s.customColumns = 42;
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(findGridVarRule(css)).toContain("--ytd-rich-grid-items-per-row: 10");
    });

    it("emits CSS on subscriptions and channel pages (same as home)", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "4";
        const subCss = startpageGridFeature.pages.subscriptions!.css!(s, dummyCtx);
        const chanCss = startpageGridFeature.pages.channel!.css!(s, dummyCtx);
        expect(findGridVarRule(subCss)).toBeDefined();
        expect(findGridVarRule(chanCss)).toBeDefined();
    });

    it("emits skeleton-card width-override rule", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "2";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(css.find((r) => r.includes(".rich-grid-media-skeleton"))).toBeDefined();
    });

    it("emits NO centering rules (fixHeightByColumns removed)", () => {
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "4";
        const css = startpageGridFeature.pages.home!.css!(s, dummyCtx);
        expect(css.find((r) => r.includes("justify-content"))).toBeUndefined();
    });
});

describe("startpage-grid run (inline JS)", () => {
    it("sets the grid variable inline on ytd-rich-grid-renderer when enabled + non-default", () => {
        document.body.innerHTML = "<ytd-rich-grid-renderer></ytd-rich-grid-renderer>";
        const el = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "4";
        const ctx: PageCtx = { page: "home", locale: "de", settings: { ...DEFAULT_SETTINGS, startpage: s } };
        startpageGridFeature.pages.home!.run!(ctx);
        expect(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")).toBe("4");
        expect(el.getAttribute("data-yt-tweaks-grid-columns")).toBe("4");
    });

    it("uses customColumns when preset=custom", () => {
        document.body.innerHTML = "<ytd-rich-grid-renderer></ytd-rich-grid-renderer>";
        const el = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "custom";
        s.customColumns = 7;
        const ctx: PageCtx = { page: "home", locale: "de", settings: { ...DEFAULT_SETTINGS, startpage: s } };
        startpageGridFeature.pages.home!.run!(ctx);
        expect(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")).toBe("7");
    });

    it("clamps customColumns to [1,10] in the inline run", () => {
        document.body.innerHTML = "<ytd-rich-grid-renderer></ytd-rich-grid-renderer>";
        const el = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "custom";
        s.customColumns = 42;
        const ctx: PageCtx = { page: "home", locale: "de", settings: { ...DEFAULT_SETTINGS, startpage: s } };
        startpageGridFeature.pages.home!.run!(ctx);
        expect(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")).toBe("10");
    });

    it("restore clears the inline variable and marker", () => {
        document.body.innerHTML = '<ytd-rich-grid-renderer data-yt-tweaks-grid-columns="4"></ytd-rich-grid-renderer>';
        const el = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        el.style.setProperty("--ytd-rich-grid-items-per-row", "4");
        startpageGridFeature.pages.home!.restore!();
        expect(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")).toBe("");
        expect(el.hasAttribute("data-yt-tweaks-grid-columns")).toBe(false);
    });

    it("run restores (clears) when disabled or default preset", () => {
        document.body.innerHTML = '<ytd-rich-grid-renderer data-yt-tweaks-grid-columns="3"></ytd-rich-grid-renderer>';
        const el = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        el.style.setProperty("--ytd-rich-grid-items-per-row", "3");
        const s = cloneStartpage();
        s.enabled = false;
        const ctx: PageCtx = { page: "home", locale: "de", settings: { ...DEFAULT_SETTINGS, startpage: s } };
        startpageGridFeature.pages.home!.run!(ctx);
        expect(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")).toBe("");
        expect(el.hasAttribute("data-yt-tweaks-grid-columns")).toBe(false);
    });

    it("run sets NO inline item widths (fixHeightByColumns removed)", () => {
        document.body.innerHTML =
            "<ytd-rich-grid-renderer><ytd-rich-item-renderer></ytd-rich-item-renderer></ytd-rich-grid-renderer>";
        const grid = document.querySelector<HTMLElement>("ytd-rich-grid-renderer")!;
        const item = grid.querySelector<HTMLElement>("ytd-rich-item-renderer")!;
        const s = cloneStartpage();
        s.enabled = true;
        s.columnsPreset = "4";
        const ctx: PageCtx = { page: "home", locale: "de", settings: { ...DEFAULT_SETTINGS, startpage: s } };
        startpageGridFeature.pages.home!.run!(ctx);
        expect(item.style.width).toBe("");
        expect(item.hasAttribute("data-yt-tweaks-fix-height")).toBe(false);
        expect(grid.hasAttribute("data-yt-tweaks-fix-height")).toBe(false);
    });
});
