import { describe, it, expect } from "vitest";
import { formatViewsNumber } from "../text";

/**
 * Pure-logic tests for `formatViewsNumber` — no DOM, no jsdom. Validates the round/truncate
 * policies and suffix application against the ViewsSettings shape, plus the locale-aware
 * number parsing (de: "." = grouping / "," = decimal; en: "," = grouping / "." = decimal)
 * and the locale-aware decimal separator of the formatted output.
 */
describe("formatViewsNumber", () => {
    const vcfg = {
        roundMode: "round" as const,
        decimals: 1,
        suffixes: { k: "k", M: "M", B: "B", T: "T" },
    };

    it("formats thousands with k suffix (de output separator)", () => {
        expect(formatViewsNumber("1234", "", vcfg)).toBe("1,2k");
    });

    it("formats millions with M suffix", () => {
        expect(formatViewsNumber("1100000", "", vcfg)).toBe("1,1M");
    });

    it("honors YT-supplied Mio. unit (German)", () => {
        expect(formatViewsNumber("1,1", "Mio.", vcfg)).toBe("1,1M");
    });

    it("honors YT-supplied Tsd. unit (German)", () => {
        expect(formatViewsNumber("12", "Tsd.", vcfg)).toBe("12k");
    });

    it("truncate mode floors instead of rounding", () => {
        expect(formatViewsNumber("1299", "", { ...vcfg, roundMode: "truncate" })).toBe("1,2k");
    });

    it("decimals=0 drops fractional part", () => {
        expect(formatViewsNumber("1234", "", { ...vcfg, decimals: 0 })).toBe("1k");
    });

    it("returns raw rounded number below 1000", () => {
        expect(formatViewsNumber("42", "", vcfg)).toBe("42");
    });

    it("returns null for non-numeric input", () => {
        expect(formatViewsNumber("abc", "", vcfg)).toBeNull();
    });

    it("uses custom suffixes", () => {
        expect(formatViewsNumber("1234", "", { ...vcfg, suffixes: { k: "K", M: "M", B: "B", T: "T" } })).toBe("1,2K");
    });

    it("en: parses dot-decimal with M unit (1.5M stays 1.5M, not 15M)", () => {
        expect(formatViewsNumber("1.5", "M", vcfg, "en")).toBe("1.5M");
    });

    it("en: parses comma-grouped bare number (294,234 → 294.2k, not 294)", () => {
        expect(formatViewsNumber("294,234", "", vcfg, "en")).toBe("294.2k");
    });

    it("en: parses multiple comma groups (1,234,567 → 1.2M)", () => {
        expect(formatViewsNumber("1,234,567", "", vcfg, "en")).toBe("1.2M");
    });

    it("en: uses dot as output decimal separator", () => {
        expect(formatViewsNumber("1234", "", vcfg, "en")).toBe("1.2k");
    });

    it("de: parses dot-grouped number (270.417 → 270,4k)", () => {
        expect(formatViewsNumber("270.417", "", vcfg, "de")).toBe("270,4k");
    });

    it("en: honors YT-supplied K unit", () => {
        expect(formatViewsNumber("12", "K", vcfg, "en")).toBe("12k");
    });
});
