import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from "../settings";

/**
 * Tests for the startpage.columnsPreset adjective-enum → numeric string-enum migration
 * in loadSettings() (small→"2", large→"4", xlarge→"5").
 *
 * Pure-logic (node env) — mocks GM_getValue. "default"/"custom" and customColumns are
 * left untouched; the removed fixHeightByColumns field is silently dropped by deepMerge
 * (only keys present in DEFAULT_SETTINGS are copied over).
 */

// * GM_getValue mock — keyed by GM-key name.
function mockGmGetValue(saved: unknown): void {
    vi.stubGlobal("GM_getValue", (key: string, def: string) => {
        if (key === SETTINGS_KEY) return JSON.stringify(saved);
        if (key === "ytTweaksEnabled") return "true";
        return def;
    });
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

/** Simulates a pre-migration saved settings object with the given startpage slice. */
function savedWithStartpage(startpage: Record<string, unknown>): Record<string, unknown> {
    const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
    saved.startpage = { ...startpage };
    return saved;
}

describe("startpage columnsPreset adjective → numeric migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("maps small → 2", () => {
        mockGmGetValue(savedWithStartpage({ enabled: true, columnsPreset: "small", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("2");
        expect(result.startpage.enabled).toBe(true);
    });

    it("maps large → 4", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "large", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("4");
    });

    it("maps xlarge → 5", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "xlarge", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("5");
    });

    it("leaves default untouched", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "default", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("default");
    });

    it("leaves custom + customColumns untouched", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "custom", customColumns: 7 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("custom");
        expect(result.startpage.customColumns).toBe(7);
    });

    it("leaves already-numeric presets untouched (post-migration shape)", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "6", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("6");
    });

    it("drops the removed fixHeightByColumns field silently", () => {
        mockGmGetValue(savedWithStartpage({ columnsPreset: "small", customColumns: 3, fixHeightByColumns: true }));
        const result = loadSettings();
        expect(result.startpage).not.toHaveProperty("fixHeightByColumns");
    });

    it("keeps migration idempotent: numeric shape is not re-migrated", () => {
        // * "2" is not in the adjective map — must pass through unchanged (no infinite churn).
        mockGmGetValue(savedWithStartpage({ columnsPreset: "2", customColumns: 3 }));
        const result = loadSettings();
        expect(result.startpage.columnsPreset).toBe("2");
    });
});
