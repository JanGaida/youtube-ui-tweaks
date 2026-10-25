import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from "../settings";

/**
 * Tests for the `ytTweaksEnabled` (legacy separate GM key) → `system.tweaksEnabled` (settings
 * JSON) migration in loadSettings().
 *
 * Pure-logic (node env) — mocks GM_getValue. The migration reads the legacy `ytTweaksEnabled`
 * GM key (only when `saved.system.tweaksEnabled` is not already a boolean) and writes the
 * parsed value into `saved.system.tweaksEnabled`.
 *
 * * The legacy key stored strings ("true"/"false"); the default was "true" (enabled).
 * * The legacy GM key is NOT deleted (backward-compat for old installs that never update).
 */

// * GM_getValue mock — keyed by GM-key name. loadSettings calls GM_getValue(SETTINGS_KEY, ...),
//   the migration calls GM_getValue("ytTweaksEnabled", "true").
function mockGmGetValue(saved: unknown, legacyTweaksEnabled?: string): void {
    vi.stubGlobal("GM_getValue", (key: string, def: string) => {
        if (key === SETTINGS_KEY) return JSON.stringify(saved);
        if (key === "ytTweaksEnabled") return legacyTweaksEnabled ?? def;
        return def;
    });
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

describe("ytTweaksEnabled → system.tweaksEnabled migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("migrates legacy 'false' → system.tweaksEnabled=false when system.tweaksEnabled absent", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * Simulate pre-migration: no system field at all.
        delete (saved as Record<string, unknown>).system;
        mockGmGetValue(saved, "false");

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(false);
        expect(result.system.anonymize).toBe(false);
    });

    it("migrates legacy 'true' → system.tweaksEnabled=true when system.tweaksEnabled absent", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved as Record<string, unknown>).system;
        mockGmGetValue(saved, "true");

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(true);
    });

    it("uses legacy default 'true' when the GM key was never set", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved as Record<string, unknown>).system;
        // * legacyTweaksEnabled undefined → GM_getValue returns the default ("true").
        mockGmGetValue(saved, undefined);

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(true);
    });

    it("does NOT overwrite an already-set system.tweaksEnabled", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        (saved as Record<string, unknown>).system = { tweaksEnabled: false, anonymize: true };
        // * Legacy says "true" — must NOT win over the explicit saved value.
        mockGmGetValue(saved, "true");

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(false);
        expect(result.system.anonymize).toBe(true);
    });

    it("migrates only tweaksEnabled when system exists but tweaksEnabled is missing", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * system exists with anonymize but no tweaksEnabled.
        (saved as Record<string, unknown>).system = { anonymize: true };
        mockGmGetValue(saved, "false");

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(false);
        expect(result.system.anonymize).toBe(true);
    });

    it("leaves system.tweaksEnabled untouched when both system + tweaksEnabled present", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        (saved as Record<string, unknown>).system = { tweaksEnabled: true, anonymize: false };
        mockGmGetValue(saved, "false");

        const result = loadSettings();
        expect(result.system.tweaksEnabled).toBe(true);
    });
});
