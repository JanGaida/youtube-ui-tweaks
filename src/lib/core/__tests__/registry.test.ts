import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    registerFeature,
    resetRegistry,
    getFeatures,
    resolveBehavior,
    getSlice,
    runAll,
    generateCSS,
    scheduleLiveApply,
    flushLiveApply,
    restoreForFeature,
    restoreAll,
    validateSettings,
    composeDefaults,
} from "../registry";
import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";

/**
 * Pure-logic tests for the FeatureRegistry — dispatch by page, CSS aggregation, live-apply key
 * lookup, validation aggregation, and defaults composition. Uses mock features (no DOM).
 */
function makeCtx(page: PageCtx["page"], settings: Settings = structuredClone(DEFAULT_SETTINGS)): PageCtx {
    return { page, locale: "de", settings };
}

describe("FeatureRegistry", () => {
    beforeEach(() => {
        resetRegistry();
    });

    describe("registerFeature", () => {
        it("registers a feature retrievable via getFeatures", () => {
            const f: Feature = { id: "x", settingsPath: "styling", pages: {}, liveApplyKeys: [] };
            registerFeature(f);
            expect(getFeatures().map((x) => x.id)).toContain("x");
        });

        it("rejects duplicate ids", () => {
            const f: Feature = { id: "dup", settingsPath: "styling", pages: {}, liveApplyKeys: [] };
            registerFeature(f);
            expect(() => registerFeature({ ...f })).toThrow("already registered");
        });
    });

    describe("resolveBehavior", () => {
        it("picks the page-specific behavior", () => {
            const f: Feature = {
                id: "t",
                settingsPath: "styling",
                pages: { home: { css: () => ["home-rule"] }, channel: { css: () => ["channel-rule"] } },
                liveApplyKeys: [],
            };
            expect(resolveBehavior(f, "home")?.css?.(undefined, makeCtx("home"))).toEqual(["home-rule"]);
            expect(resolveBehavior(f, "channel")?.css?.(undefined, makeCtx("channel"))).toEqual(["channel-rule"]);
        });

        it("falls back to '*' wildcard", () => {
            const f: Feature = {
                id: "t",
                settingsPath: "styling",
                pages: { "*": { css: () => ["wildcard"] } },
                liveApplyKeys: [],
            };
            expect(resolveBehavior(f, "watch")?.css?.(undefined, makeCtx("watch"))).toEqual(["wildcard"]);
        });

        it("returns undefined when no behavior matches", () => {
            const f: Feature = { id: "t", settingsPath: "styling", pages: { home: {} }, liveApplyKeys: [] };
            expect(resolveBehavior(f, "watch")).toBeUndefined();
        });
    });

    describe("getSlice", () => {
        it("reads a nested slice", () => {
            const s = { styling: { titleAlign: "center" } } as unknown as Settings;
            expect(getSlice(s, "styling.titleAlign")).toBe("center");
        });
    });

    describe("runAll", () => {
        it("runs only features with a matching run behavior", () => {
            const runHome = vi.fn();
            const runWatch = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { run: runHome }, watch: { run: runWatch } },
                liveApplyKeys: [],
            });
            runAll(makeCtx("home"));
            expect(runHome).toHaveBeenCalledOnce();
            expect(runWatch).not.toHaveBeenCalled();
        });

        it("does not run features with no behavior for the page", () => {
            const run = vi.fn();
            registerFeature({ id: "a", settingsPath: "styling", pages: { home: { run } }, liveApplyKeys: [] });
            runAll(makeCtx("watch"));
            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("generateCSS", () => {
        it("aggregates css from all matching features", () => {
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { css: () => [".a { color: red }"] } },
                liveApplyKeys: [],
            });
            registerFeature({
                id: "b",
                settingsPath: "ads",
                pages: { "*": { css: () => [".b { display: none }"] } },
                liveApplyKeys: [],
            });
            const css = generateCSS(structuredClone(DEFAULT_SETTINGS), makeCtx("home"));
            expect(css).toContain(".a { color: red }");
            expect(css).toContain(".b { display: none }");
        });

        it("passes the feature's settings slice to css", () => {
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: {
                    home: {
                        css: (slice) => [`text-align: ${(slice as { titleAlign: string }).titleAlign}`],
                    },
                },
                liveApplyKeys: [],
            });
            const s = structuredClone(DEFAULT_SETTINGS);
            s.styling.titleAlign = "center";
            expect(generateCSS(s, makeCtx("home", s))).toContain("text-align: center");
        });
    });

    describe("scheduleLiveApply", () => {
        it("restores only features whose liveApplyKeys include the changed key", () => {
            vi.useFakeTimers();
            const restoreA = vi.fn();
            const restoreB = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { restore: restoreA } },
                liveApplyKeys: ["styling.titleAlign"],
            });
            registerFeature({
                id: "b",
                settingsPath: "ads",
                pages: { home: { restore: restoreB } },
                liveApplyKeys: ["ads.promo.hideMemberOnly"],
            });
            const applyCss = vi.fn();
            scheduleLiveApply(structuredClone(DEFAULT_SETTINGS), "styling.titleAlign", makeCtx("home"), applyCss);
            vi.advanceTimersByTime(200);
            expect(restoreA).toHaveBeenCalledOnce();
            expect(restoreB).not.toHaveBeenCalled();
            vi.useRealTimers();
        });

        it("debounces rapid calls into one update", () => {
            vi.useFakeTimers();
            const restore = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { restore } },
                liveApplyKeys: ["styling.titleAlign"],
            });
            const applyCss = vi.fn();
            scheduleLiveApply(structuredClone(DEFAULT_SETTINGS), "styling.titleAlign", makeCtx("home"), applyCss);
            scheduleLiveApply(structuredClone(DEFAULT_SETTINGS), "styling.titleAlign", makeCtx("home"), applyCss);
            vi.advanceTimersByTime(200);
            expect(restore).toHaveBeenCalledOnce();
            vi.useRealTimers();
        });
    });

    describe("flushLiveApply", () => {
        it("applies css immediately and clears pending", () => {
            const applyCss = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { css: () => [".x{c:1}"] } },
                liveApplyKeys: [],
            });
            flushLiveApply(structuredClone(DEFAULT_SETTINGS), makeCtx("home"), applyCss);
            expect(applyCss).toHaveBeenCalledOnce();
        });
    });

    describe("restoreForFeature", () => {
        it("runs restore for the named feature only", () => {
            const restoreA = vi.fn();
            const restoreB = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { restore: restoreA } },
                liveApplyKeys: [],
            });
            registerFeature({
                id: "b",
                settingsPath: "ads",
                pages: { home: { restore: restoreB } },
                liveApplyKeys: [],
            });
            restoreForFeature("a", makeCtx("home"));
            expect(restoreA).toHaveBeenCalledOnce();
            expect(restoreB).not.toHaveBeenCalled();
        });
    });

    describe("restoreAll", () => {
        it("calls every registered restore function once", () => {
            const restoreA = vi.fn();
            const restoreB = vi.fn();
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: { home: { restore: restoreA } },
                liveApplyKeys: [],
            });
            registerFeature({
                id: "b",
                settingsPath: "ads",
                pages: { "*": { restore: restoreB } },
                liveApplyKeys: [],
            });
            restoreAll();
            expect(restoreA).toHaveBeenCalledOnce();
            expect(restoreB).toHaveBeenCalledOnce();
        });

        it("dedupes the same restore function across multiple page entries", () => {
            // * text-shorten registers `restoreText` under home/subscriptions/channel/search/watch.
            //   restoreAll must call it exactly once (not 5x).
            const restoreText = vi.fn();
            registerFeature({
                id: "text-shorten",
                settingsPath: "textShorten",
                pages: {
                    home: { restore: restoreText },
                    subscriptions: { restore: restoreText },
                    channel: { restore: restoreText },
                    search: { restore: restoreText },
                    watch: { restore: restoreText },
                },
                liveApplyKeys: [],
            });
            restoreAll();
            expect(restoreText).toHaveBeenCalledOnce();
        });

        it("is a no-op when no features have a restore", () => {
            registerFeature({ id: "a", settingsPath: "styling", pages: {}, liveApplyKeys: [] });
            expect(() => restoreAll()).not.toThrow();
        });
    });

    describe("validateSettings", () => {
        it("aggregates errors from all features with a validator", () => {
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: {},
                liveApplyKeys: [],
                validate: () => [{ path: "styling.titleFontSize", message: "bad" }],
            });
            registerFeature({
                id: "b",
                settingsPath: "ads",
                pages: {},
                liveApplyKeys: [],
                validate: () => [{ path: "ads.promo.hideMemberOnly", message: "nope" }],
            });
            const errors = validateSettings(structuredClone(DEFAULT_SETTINGS));
            expect(errors).toHaveLength(2);
            expect(errors.map((e) => e.path)).toContain("styling.titleFontSize");
        });

        it("returns no errors when no features have validators", () => {
            registerFeature({ id: "a", settingsPath: "styling", pages: {}, liveApplyKeys: [] });
            expect(validateSettings(structuredClone(DEFAULT_SETTINGS))).toEqual([]);
        });
    });

    describe("composeDefaults", () => {
        it("merges feature defaults over the base", () => {
            registerFeature({
                id: "a",
                settingsPath: "styling",
                pages: {},
                liveApplyKeys: [],
                defaults: { styling: { titleAlign: "center" } },
            });
            const composed = composeDefaults(structuredClone(DEFAULT_SETTINGS));
            expect(composed.styling.titleAlign).toBe("center");
            // * Untouched defaults remain.
            expect(composed.styling.enabled).toBe(DEFAULT_SETTINGS.styling.enabled);
        });
    });
});
