// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { guideEntriesFeature } from "../features/guide-entries";
import { SECTION_GROUP_ATTR } from "../features/guide-groups";

/**
 * Guide-entries idempotency regression tests:
 * 1. A mid-run failure must NOT poison the settings hash — the next pass must re-apply.
 * 2. Restore must remove the section-group classification markers.
 *
 * Fixtures are gitignored, so the whole file skips on a fresh clone/CI.
 */
function makeCtx(settings: Settings): { page: "home"; locale: string; settings: Settings } {
    return { page: "home", locale: "de", settings };
}

describe.skipIf(!fixtureExists("guide-full"))("guide-entries idempotency", () => {
    let settings: Settings;

    beforeEach(() => {
        loadFixture("guide-full");
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.guide.enabled = true;
        settings.guide.entries.hidden = { home: true };
    });

    it("retries after a mid-run failure instead of skipping forever", () => {
        const ctx = makeCtx(settings);
        const run = guideEntriesFeature.pages["*"]?.run;
        expect(run).toBeTruthy();

        const original = document.querySelectorAll.bind(document);
        const spy = vi.spyOn(document, "querySelectorAll").mockImplementation(((selector: string) => {
            if (selector === "ytd-guide-section-renderer") throw new Error("boom");
            return original(selector);
        }) as typeof document.querySelectorAll);

        expect(() => run?.(ctx)).toThrow("boom");
        spy.mockRestore();

        // * Unchanged settings — the failed pass must not have set lastEntriesHash.
        run?.(ctx);

        const home = document
            .querySelector<HTMLElement>('ytd-guide-entry-renderer a[href="/"]')
            ?.closest<HTMLElement>("ytd-guide-entry-renderer");
        expect(home?.style.display).toBe("none");
    });

    it("removes section group markers on restore", () => {
        const section = document.querySelector<HTMLElement>("ytd-guide-section-renderer");
        expect(section).toBeTruthy();
        section?.setAttribute(SECTION_GROUP_ATTR, "subscriptions");

        guideEntriesFeature.pages["*"]?.restore?.();

        expect(section?.hasAttribute(SECTION_GROUP_ATTR)).toBe(false);
    });
});
