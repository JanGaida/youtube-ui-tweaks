// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for the kill-switch apply logic (`applyToggleState`) — verifies it calls observer +
 * css + registry functions correctly and removes the tweak `<style>` + calls restoreAll on
 * disable. The store/setTweaksEnabled path is covered indirectly (it delegates to applyToggleState).
 *
 * jsdom env: applyToggleState touches `document.getElementById` + `document.head`.
 *
 * ! Modules are mocked so the test doesn't pull in the Svelte-runes store or the full registry.
 *   We assert call counts + order, not real DOM mutation (that's the E2E test's job).
 * ! vi.mock factories are hoisted by Vitest — they CANNOT reference outer variables. All mock
 *   functions are created INSIDE the factories and accessed via the mocked module's exports.
 */

// * Mock the observer module (startObserver/stopObserver/runAll + currentSettings getter).
//   The mock fns are exposed via the module exports; tests grab them after import.
vi.mock("../observer", () => {
    const startObserver = vi.fn();
    const stopObserver = vi.fn();
    const runAll = vi.fn();
    const mockSettings = { system: { tweaksEnabled: true, anonymize: false } };
    return {
        // * Getter so `currentSettings` always reads the live mockSettings object.
        get currentSettings() {
            return mockSettings;
        },
        // * Expose the mutable settings + fns for tests (via a hidden namespace key).
        startObserver,
        stopObserver,
        runAll,
        __mockSettings: mockSettings,
    };
});

vi.mock("../css", () => {
    const applyCSS = vi.fn();
    return { applyCSS, STYLE_ID: "yt-tweaks-css" };
});

vi.mock("../registry", () => {
    const restoreAll = vi.fn();
    return { restoreAll };
});

vi.mock("../../stores/settings.svelte", () => {
    const setByPath = vi.fn();
    const save = vi.fn();
    return { store: { setByPath, save } };
});

vi.mock("../log", () => ({
    default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

// * Import AFTER mocks are registered.
import { applyToggleState, setTweaksEnabled, isTweaksEnabled } from "../system-toggle";
// * Grab the mocked fns from the (mocked) module namespace.
import * as observerMock from "../observer";
import * as cssMock from "../css";
import * as registryMock from "../registry";
import * as storeMock from "../../stores/settings.svelte";

// * Grab the mocked fns from the (mocked) module namespace. Double-cast via unknown:
//   the mocked module type no longer overlaps its real shape (vi.fn replaces the fns).
const startObserver = (observerMock as unknown as { startObserver: ReturnType<typeof vi.fn> }).startObserver;
const stopObserver = (observerMock as unknown as { stopObserver: ReturnType<typeof vi.fn> }).stopObserver;
const runAll = (observerMock as unknown as { runAll: ReturnType<typeof vi.fn> }).runAll;
const mockSettings = (
    observerMock as unknown as { __mockSettings: { system: { tweaksEnabled: boolean; anonymize: boolean } } }
).__mockSettings;
const applyCSS = (cssMock as unknown as { applyCSS: ReturnType<typeof vi.fn> }).applyCSS;
const restoreAll = (registryMock as unknown as { restoreAll: ReturnType<typeof vi.fn> }).restoreAll;
const storeMockRec = storeMock as unknown as {
    store: { setByPath: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
};
const setByPath = storeMockRec.store.setByPath;
const save = storeMockRec.store.save;

describe("system-toggle (kill-switch)", () => {
    beforeEach(() => {
        startObserver.mockClear();
        stopObserver.mockClear();
        runAll.mockClear();
        applyCSS.mockClear();
        restoreAll.mockClear();
        setByPath.mockClear();
        save.mockClear();
        // * Ensure the tweak style is present for disable-path tests that remove it.
        document.head.innerHTML = '<style id="yt-tweaks-css"></style>';
    });

    describe("isTweaksEnabled", () => {
        it("reads system.tweaksEnabled from currentSettings", () => {
            mockSettings.system.tweaksEnabled = true;
            expect(isTweaksEnabled()).toBe(true);
            mockSettings.system.tweaksEnabled = false;
            expect(isTweaksEnabled()).toBe(false);
        });
    });

    describe("applyToggleState(true)", () => {
        it("applies CSS, starts observer, runs all features", () => {
            applyToggleState(true);
            expect(applyCSS).toHaveBeenCalledOnce();
            expect(startObserver).toHaveBeenCalledOnce();
            expect(runAll).toHaveBeenCalledOnce();
        });

        it("does NOT stop the observer or call restoreAll", () => {
            applyToggleState(true);
            expect(stopObserver).not.toHaveBeenCalled();
            expect(restoreAll).not.toHaveBeenCalled();
        });
    });

    describe("applyToggleState(false)", () => {
        it("stops observer, removes the tweak <style>, and calls restoreAll", () => {
            const style = document.getElementById("yt-tweaks-css");
            expect(style).not.toBeNull();
            applyToggleState(false);
            expect(stopObserver).toHaveBeenCalledOnce();
            expect(restoreAll).toHaveBeenCalledOnce();
            expect(document.getElementById("yt-tweaks-css")).toBeNull();
        });

        it("does NOT apply CSS or start the observer", () => {
            applyToggleState(false);
            expect(applyCSS).not.toHaveBeenCalled();
            expect(startObserver).not.toHaveBeenCalled();
        });

        it("is safe when the tweak <style> is already absent", () => {
            document.head.innerHTML = "";
            expect(() => applyToggleState(false)).not.toThrow();
            expect(restoreAll).toHaveBeenCalledOnce();
        });

        it("does NOT remove the anonymize layer <style> (independent feature)", () => {
            document.head.innerHTML = '<style id="yt-tweaks-css"></style><style id="yt-tweaks-anonymize-css"></style>';
            applyToggleState(false);
            expect(document.getElementById("yt-tweaks-css")).toBeNull();
            expect(document.getElementById("yt-tweaks-anonymize-css")).not.toBeNull();
        });
    });

    describe("setTweaksEnabled", () => {
        it("mutates the store, persists immediately, and applies the state", () => {
            setTweaksEnabled(false);
            expect(setByPath).toHaveBeenCalledWith("system.tweaksEnabled", false);
            expect(save).toHaveBeenCalledOnce();
            expect(stopObserver).toHaveBeenCalledOnce();
            expect(restoreAll).toHaveBeenCalledOnce();
        });
    });
});
