import { describe, it, expect, afterEach, vi } from "vitest";
import {
    DEFAULT_SETTINGS,
    deepMergeSettings,
    isSettingsObject,
    loadSettings,
    readStoredLogLevel,
    saveSettings,
} from "../settings";
import { resetLoggerState, setLogLevel } from "../log";

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

describe("settings persistence", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        setLogLevel("silent");
        resetLoggerState();
        vi.restoreAllMocks();
    });

    it("accepts plain objects and rejects null, arrays and scalars", () => {
        expect(isSettingsObject({})).toBe(true);
        expect(isSettingsObject({ a: 1 })).toBe(true);
        expect(isSettingsObject(null)).toBe(false);
        expect(isSettingsObject([])).toBe(false);
        expect(isSettingsObject("x")).toBe(false);
        expect(isSettingsObject(42)).toBe(false);
    });

    it("falls back to defaults for corrupt JSON and logs an error", () => {
        setLogLevel("error");
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("GM_getValue", () => "{broken");

        const s = loadSettings();

        expect(s.system.tweaksEnabled).toBe(DEFAULT_SETTINGS.system.tweaksEnabled);
        expect(errorSpy).toHaveBeenCalledOnce();
        const payload = errorSpy.mock.calls[0].at(-1) as Record<string, unknown>;
        expect(payload.key).toBe("ytTweaksSettings");
        expect(payload.rawLength).toBe(7);
    });

    it("warns and uses defaults for an array payload", () => {
        setLogLevel("warn");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubGlobal("GM_getValue", () => "[]");

        const s = loadSettings();

        expect(s).toBeTruthy();
        expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("logs and rethrows when persistence fails", () => {
        setLogLevel("error");
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("GM_setValue", () => {
            throw new Error("quota");
        });

        expect(() => saveSettings(structuredClone(DEFAULT_SETTINGS))).toThrow("quota");
        expect(errorSpy).toHaveBeenCalledOnce();
        const payload = errorSpy.mock.calls[0].at(-1) as Record<string, unknown>;
        expect(payload.error).toMatchObject({ message: "quota" });
    });

    it("logs debug on successful persistence", () => {
        setLogLevel("debug");
        const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.stubGlobal("GM_setValue", () => {});

        saveSettings(structuredClone(DEFAULT_SETTINGS));

        expect(debugSpy).toHaveBeenCalledOnce();
    });
});

/**
 * Regression: dynamic boolean maps (guide entry/group hide flags) default to `{}`, so the
 * key-driven schema merge dropped every saved key on load/import — hidden guide entries and
 * groups reappeared after a reload (F5).
 */
describe("dynamic boolean maps", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("restores hidden guide entries and groups on load", () => {
        vi.stubGlobal("GM_getValue", (key: string, def: unknown) =>
            key === "ytTweaksSettings"
                ? JSON.stringify({
                      guide: {
                          entries: {
                              hidden: { home: true, shorts: true },
                              groups: { hidden: { main: true, subscriptions: false } },
                          },
                      },
                  })
                : def,
        );

        const s = loadSettings();

        expect(s.guide.entries.hidden).toEqual({ home: true, shorts: true });
        expect(s.guide.entries.groups.hidden).toEqual({ main: true, subscriptions: false });
    });

    it("restores hidden maps on import (deepMergeSettings)", () => {
        const merged = deepMergeSettings(DEFAULT_SETTINGS, {
            guide: { entries: { hidden: { live: true } } },
        });

        expect(merged.guide.entries.hidden.live).toBe(true);
    });

    it("copies unknown boolean keys but ignores non-boolean junk in dynamic maps", () => {
        const merged = deepMergeSettings(DEFAULT_SETTINGS, {
            guide: {
                entries: {
                    hidden: { customEntry: true, broken: "yes" },
                },
            },
        });

        expect(merged.guide.entries.hidden.customEntry).toBe(true);
        expect("broken" in merged.guide.entries.hidden).toBe(false);
    });

    it("still drops unknown keys outside the dynamic maps (schema safety)", () => {
        const merged = deepMergeSettings(DEFAULT_SETTINGS, {
            guide: { entries: { bogus: true } },
        });

        expect("bogus" in merged.guide.entries).toBe(false);
    });
});
