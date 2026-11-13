import { describe, it, expect, afterEach, vi } from "vitest";
import { readStoredLogLevel } from "../settings";

/**
 * Tests for the boot-time log-level pre-read. `readStoredLogLevel` must never throw and must
 * return "silent" for absent/invalid storage so boot logging never enables itself by accident.
 */
function stubRaw(raw: unknown): void {
    vi.stubGlobal("GM_getValue", () => raw);
}

describe("readStoredLogLevel", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reads a valid stored level", () => {
        stubRaw(JSON.stringify({ debug: { logLevel: "debug" } }));
        expect(readStoredLogLevel()).toBe("debug");
    });

    it("reads every valid settings level", () => {
        for (const level of ["debug", "info", "warn", "error", "silent"]) {
            stubRaw(JSON.stringify({ debug: { logLevel: level } }));
            expect(readStoredLogLevel()).toBe(level);
        }
    });

    it("falls back to silent when the debug block is absent", () => {
        stubRaw(JSON.stringify({ styling: { enabled: true } }));
        expect(readStoredLogLevel()).toBe("silent");
    });

    it("falls back to silent for an unknown level label", () => {
        stubRaw(JSON.stringify({ debug: { logLevel: "verbose" } }));
        expect(readStoredLogLevel()).toBe("silent");
    });

    it("falls back to silent for corrupt JSON instead of throwing", () => {
        stubRaw("{not json");
        expect(() => readStoredLogLevel()).not.toThrow();
        expect(readStoredLogLevel()).toBe("silent");
    });

    it("accepts a non-string raw value (manager returning an object)", () => {
        stubRaw({ debug: { logLevel: "warn" } });
        expect(readStoredLogLevel()).toBe("warn");
    });

    it("falls back to silent for an array payload", () => {
        stubRaw(JSON.stringify([{ debug: { logLevel: "debug" } }]));
        expect(readStoredLogLevel()).toBe("silent");
    });
});
