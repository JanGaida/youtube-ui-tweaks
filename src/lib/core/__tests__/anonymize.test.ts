// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { generateAnonymizeCSS, applyAnonymize, ANON_STYLE_ID } from "../anonymize";

/**
 * Tests for the anonymize layer — CSS generation + `<style>` mount/unmount in jsdom.
 *
 * Pure DOM assertions (no YouTube fixture needed): the module injects a `<style>` element by id,
 * so we only verify presence/absence and CSS content. Selector correctness against real YouTube
 * DOM is covered by the fixture-based manual smoke-test (dev-build), not here.
 *
 * ! generateAnonymizeCSS now takes a blur argument (px). Images get 1.5x the text blur.
 */
describe("anonymize layer", () => {
    beforeEach(() => {
        // * Ensure a clean DOM between tests.
        document.getElementById(ANON_STYLE_ID)?.remove();
    });

    describe("generateAnonymizeCSS", () => {
        it("emits blur rules for grid-item metadata + channel name + comment text", () => {
            const css = generateAnonymizeCSS(12);
            expect(css).toContain(".ytLockupViewModelMetadata");
            expect(css).toContain("ytd-channel-name");
            expect(css).toContain("ytd-comment-renderer #content-text");
        });

        it("emits blur rules for thumbnails + avatars + the video player", () => {
            const css = generateAnonymizeCSS(12);
            // * Thumbnails in grid items + watch recommendations.
            expect(css).toContain(".ytThumbnailViewModelImage");
            // * Avatars (grid items, masthead, comments).
            expect(css).toContain(".ytLockupMetadataViewModelAvatar");
            expect(css).toContain("#avatar yt-img-shadow");
            expect(css).toContain("ytd-comment-renderer yt-img-shadow");
            // * The watch-page video player frame.
            expect(css).toContain("#movie_player video");
        });

        it("applies 1.5x blur to images vs text", () => {
            const css = generateAnonymizeCSS(10);
            // * Text uses the raw blur value.
            expect(css).toContain("blur(10px)");
            // * Images use 1.5x = 15px.
            expect(css).toContain("blur(15px)");
        });

        it("scopes the masthead avatar via #avatar ancestor (not bare yt-img-shadow)", () => {
            const css = generateAnonymizeCSS(12);
            expect(css).toContain("#avatar yt-img-shadow");
            expect(css).not.toMatch(/^yt-img-shadow\s*\{/);
            expect(css).not.toMatch(/^\s*yt-img-shadow\s*\{/m);
        });

        it("all rules use !important", () => {
            const css = generateAnonymizeCSS(12);
            const lines = css.split("\n").filter((l) => l.trim());
            for (const line of lines) {
                expect(line).toContain("!important");
            }
        });

        it("returns empty string when blur <= 0", () => {
            expect(generateAnonymizeCSS(0)).toBe("");
            expect(generateAnonymizeCSS(-5)).toBe("");
        });
    });

    describe("applyAnonymize", () => {
        it("mounts a <style> element when enabled", () => {
            applyAnonymize(true);
            const el = document.getElementById(ANON_STYLE_ID) as HTMLStyleElement | null;
            expect(el).not.toBeNull();
            expect(el!.tagName).toBe("STYLE");
            expect(el!.textContent).toContain("filter: blur");
        });

        it("updates the existing <style> when re-enabled (no duplicate)", () => {
            applyAnonymize(true);
            applyAnonymize(true);
            const els = document.querySelectorAll(`#${ANON_STYLE_ID}`);
            expect(els).toHaveLength(1);
        });

        it("removes the <style> element when disabled", () => {
            applyAnonymize(true);
            expect(document.getElementById(ANON_STYLE_ID)).not.toBeNull();
            applyAnonymize(false);
            expect(document.getElementById(ANON_STYLE_ID)).toBeNull();
        });

        it("is a no-op when disabled and no style is present", () => {
            expect(document.getElementById(ANON_STYLE_ID)).toBeNull();
            expect(() => applyAnonymize(false)).not.toThrow();
            expect(document.getElementById(ANON_STYLE_ID)).toBeNull();
        });

        it("can re-enable after disable (idempotent cycle)", () => {
            applyAnonymize(true);
            applyAnonymize(false);
            applyAnonymize(true);
            const el = document.getElementById(ANON_STYLE_ID);
            expect(el).not.toBeNull();
            expect(el!.textContent).toContain("filter: blur");
        });
    });
});
