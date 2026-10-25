import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, DEFAULT_SETTINGS } from "../settings";

/**
 * Tests for the menuSidebarMode → hideHamburger + guide.visibility migration.
 *
 * Pure-logic (node env) — mocks GM_getValue to return a saved-settings JSON string,
 * then verifies that loadSettings() splits the old menuSidebarMode into the two new
 * settings correctly, and removes the old field.
 */

// * Mock GM_getValue — loadSettings calls it with SETTINGS_KEY.
function mockGmGetValue(saved: unknown): void {
    vi.stubGlobal("GM_getValue", (_key: string, _default: string) => JSON.stringify(saved));
}

function unmockGm(): void {
    vi.unstubAllGlobals();
}

describe("menuSidebarMode → hideHamburger + guide.visibility migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    it("standard → hideHamburger=false, guide.visibility=default", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.menuSidebarMode = "standard";
        delete masthead.hideHamburger;
        delete (saved as Record<string, unknown>).guide;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideHamburger).toBe(false);
        expect(result.guide.visibility).toBe("default");
        expect((result.styling.masthead as unknown as Record<string, unknown>).menuSidebarMode).toBeUndefined();
    });

    it("hidden → hideHamburger=true, guide.visibility=hide-forced", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.menuSidebarMode = "hidden";
        delete masthead.hideHamburger;
        delete (saved as Record<string, unknown>).guide;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideHamburger).toBe(true);
        expect(result.guide.visibility).toBe("hide-forced");
        expect((result.styling.masthead as unknown as Record<string, unknown>).menuSidebarMode).toBeUndefined();
    });

    it("toggle → hideHamburger=false, guide.visibility=hide-override", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.menuSidebarMode = "toggle";
        delete masthead.hideHamburger;
        delete (saved as Record<string, unknown>).guide;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideHamburger).toBe(false);
        expect(result.guide.visibility).toBe("hide-override");
        expect((result.styling.masthead as unknown as Record<string, unknown>).menuSidebarMode).toBeUndefined();
    });

    it("minimal (legacy) → hideHamburger=false, guide.visibility=hide-override", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.menuSidebarMode = "minimal";
        delete masthead.hideHamburger;
        delete (saved as Record<string, unknown>).guide;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideHamburger).toBe(false);
        expect(result.guide.visibility).toBe("hide-override");
        expect((result.styling.masthead as unknown as Record<string, unknown>).menuSidebarMode).toBeUndefined();
    });

    it("does not migrate when menuSidebarMode is absent (already migrated)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        delete masthead.menuSidebarMode;
        masthead.hideHamburger = true;
        (saved as Record<string, unknown>).guide = { visibility: "hide-override" };
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.styling.masthead.hideHamburger).toBe(true);
        expect(result.guide.visibility).toBe("hide-override");
    });

    it("preserves guide settings that were already saved (no migration overwrite)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        const masthead = (saved.styling as Record<string, unknown>).masthead as Record<string, unknown>;
        masthead.menuSidebarMode = "hidden";
        delete masthead.hideHamburger;
        // * guide.visibility already set to something — migration should NOT overwrite it.
        (saved as Record<string, unknown>).guide = { visibility: "default" };
        mockGmGetValue(saved);

        const result = loadSettings();
        // * menuSidebarMode is still migrated (removed + hideHamburger set), but guide.visibility
        //   is preserved because the guide object already exists.
        expect(result.styling.masthead.hideHamburger).toBe(true);
        expect(result.guide.visibility).toBe("default");
        expect((result.styling.masthead as unknown as Record<string, unknown>).menuSidebarMode).toBeUndefined();
    });
});

describe("guide.width {mini,full} → GuideWidthPreset migration", () => {
    beforeEach(() => unmockGm());
    afterEach(() => unmockGm());

    function setWidth(saved: Record<string, unknown>, full: number): void {
        if (!saved.guide) saved.guide = {};
        (saved.guide as Record<string, unknown>).width = { mini: 0, full };
    }

    it("full=0 → default", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.guide as Record<string, unknown>).width;
        setWidth(saved, 0);
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("default");
    });

    it("full=50 (<100) → compact", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.guide as Record<string, unknown>).width;
        setWidth(saved, 50);
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("compact");
    });

    it("full=150 (>=100, <220) → compact", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.guide as Record<string, unknown>).width;
        setWidth(saved, 150);
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("compact");
    });

    it("full=240 (>=220) → large", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved.guide as Record<string, unknown>).width;
        setWidth(saved, 240);
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("large");
    });

    it("does not migrate when width is already a string preset", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        // * DEFAULT_SETTINGS ships the curated width "large" (string preset) — leave it.
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("large");
    });

    it("does not migrate when guide object absent (curated defaults apply)", () => {
        const saved = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        delete (saved as Record<string, unknown>).guide;
        mockGmGetValue(saved);

        const result = loadSettings();
        expect(result.guide.width).toBe("large");
    });
});
