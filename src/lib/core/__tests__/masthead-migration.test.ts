import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS } from "../settings";

/**
 * Tests for the searchButton-Enum → hideSearchButton-Boolean migration.
 *
 * Pure-logic (node env) — mocks GM_getValue to return a saved-settings JSON string,
 * then verifies that loadSettings() maps the old "default"|"hide" enum onto the new
 * boolean and removes the old field.
 */

// * Mock GM_getValue — loadSettings calls it with SETTINGS_KEY.
function mockGmGetValue(saved: unknown): void {
    vi.stubGlobal("GM_getValue", (_key: string, _default: string) => JSON.stringify(saved));
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

describe("searchButton enum → hideSearchButton boolean migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it('"hide" → hideSearchButton=true, old key removed', () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.searchButton = "hide";
        delete masthead.hideSearchButton;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideSearchButton).toBe(true);
        expect((result.styling.masthead as unknown as Record<string, unknown>).searchButton).toBeUndefined();
    });

    it('"default" → hideSearchButton=false, old key removed', () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.searchButton = "default";
        delete masthead.hideSearchButton;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideSearchButton).toBe(false);
        expect((result.styling.masthead as unknown as Record<string, unknown>).searchButton).toBeUndefined();
    });

    it("does not migrate when searchButton is absent (already migrated)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.hideSearchButton = true;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideSearchButton).toBe(true);
    });

    it("defaults to hideSearchButton=true when masthead object is absent (curated default)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.styling as Record<string, unknown>).masthead;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideSearchButton).toBe(true);
    });
});

/**
 * Tests for the styling.menuButton.margin removal migration.
 *
 * The old margin field overrode the wrapper's native margin (which positions the button
 * flush to the metadata block) and made the button jump into the corner. loadSettings()
 * deletes the legacy key once; no mapping needed.
 */
describe("styling.menuButton.margin removal migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("removes a saved margin key", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const menuButton = (saved.styling as Record<string, unknown>).menuButton as Record<string, unknown>;
        menuButton.margin = "8px";
        mockGmGetValue(saved);

        const result = loadSettings();
        expect((result.styling.menuButton as unknown as Record<string, unknown>).margin).toBeUndefined();
    });

    it("does not touch other menuButton fields when margin is absent", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.menuButton.enabled).toBe(true);
        expect(result.styling.menuButton.size).toBe("large");
    });
});
