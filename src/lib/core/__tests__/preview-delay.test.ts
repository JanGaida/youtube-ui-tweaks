import { describe, it, expect } from "vitest";
import { previewDelayFeature, VALID_DELAYS } from "../features/preview-delay";
import { DEFAULT_SETTINGS, type PreviewDelaySettings } from "../settings";

/**
 * Pure-logic tests for the preview-delay feature validator + CSS contract.
 *
 * Covers: valid delay enum values, validation (valid/invalid enabled + delayMs), and the
 * CSS contract (css() always returns [] — the gate is managed via a dedicated `<style>`
 * element in run/restore, decoupled from the registry CSS pipeline).
 */
describe("preview-delay helpers", () => {
    describe("VALID_DELAYS", () => {
        it("contains 0 (off) plus 10 delay values in ascending order", () => {
            expect(VALID_DELAYS).toHaveLength(11);
            expect(VALID_DELAYS[0]).toBe(0);
            for (let i = 1; i < VALID_DELAYS.length; i++) {
                expect(VALID_DELAYS[i]).toBeGreaterThan(VALID_DELAYS[i - 1]);
            }
        });

        it("includes the sub-2s values and the full range", () => {
            for (const v of [500, 750, 1000, 1250, 1500, 2000, 3000, 5000, 8000, 10000]) {
                expect(VALID_DELAYS).toContain(v);
            }
        });
    });
});

describe("preview-delay validate", () => {
    const valid = structuredClone(DEFAULT_SETTINGS.previewDelay) as PreviewDelaySettings;

    it("accepts valid default config (enabled=false, delayMs=0)", () => {
        const errors = previewDelayFeature.validate!(valid);
        expect(errors).toEqual([]);
    });

    it("accepts all valid delayMs enum values", () => {
        for (const delayMs of VALID_DELAYS) {
            const s = structuredClone(valid) as PreviewDelaySettings;
            s.delayMs = delayMs;
            const errors = previewDelayFeature.validate!(s);
            expect(errors).toEqual([]);
        }
    });

    it("rejects unknown delayMs (e.g. 1234)", () => {
        const s = structuredClone(valid) as PreviewDelaySettings;
        s.delayMs = 1234;
        const errors = previewDelayFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("previewDelay.delayMs");
    });

    it("rejects non-boolean enabled", () => {
        const s = structuredClone(valid) as PreviewDelaySettings;
        (s as unknown as Record<string, unknown>).enabled = "yes";
        const errors = previewDelayFeature.validate!(s);
        expect(errors.map((e) => e.path)).toContain("previewDelay.enabled");
    });
});

describe("preview-delay CSS contract", () => {
    it("css() returns [] (gate is self-managed via <style>, not registry CSS)", () => {
        const s = structuredClone(DEFAULT_SETTINGS.previewDelay) as PreviewDelaySettings;
        s.enabled = true;
        s.delayMs = 2000;
        const css = previewDelayFeature.pages.home!.css!(s, undefined as never);
        expect(css).toEqual([]);
    });

    it("css() returns [] even when disabled", () => {
        const s = structuredClone(DEFAULT_SETTINGS.previewDelay) as PreviewDelaySettings;
        s.enabled = false;
        const css = previewDelayFeature.pages.home!.css!(s, undefined as never);
        expect(css).toEqual([]);
    });
});

describe("preview-delay feature metadata", () => {
    it("registers for grid pages only (home, subscriptions, channel — not watch/search/shorts)", () => {
        const pages = Object.keys(previewDelayFeature.pages);
        expect(pages).toEqual(expect.arrayContaining(["home", "subscriptions", "channel"]));
        expect(pages).not.toContain("watch");
        expect(pages).not.toContain("search");
        expect(pages).not.toContain("shorts");
    });

    it("liveApplyKeys cover enabled + delayMs", () => {
        expect(previewDelayFeature.liveApplyKeys).toEqual(
            expect.arrayContaining(["previewDelay.enabled", "previewDelay.delayMs"]),
        );
    });

    it("defaults slice is disabled with 0ms delay", () => {
        expect(previewDelayFeature.defaults?.previewDelay).toEqual({ enabled: false, delayMs: 0 });
    });
});
