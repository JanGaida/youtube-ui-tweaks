import { DEFAULT_SETTINGS, loadSettings, saveSettings, deepMergeSettings, type Settings } from "../core/settings";
import { setLogLevel } from "../core/log";
import {
    applyAllLive,
    scheduleLiveApply,
    flushLiveApply,
    setCurrentSettings,
    restoreAndRunAll,
} from "../core/observer";
import { validation } from "./validation.svelte";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Settings store (Svelte 5 Runes)
// ─────────────────────────────────────────────────────────────────────────────
// * Single source of truth. The GUI binds reactively, core reads via getter.
//   The `.svelte.ts` file extension is required for runes in non-`.svelte` modules.

const REM_RE = /^\d*\.?\d+rem$/;

/**
 * Validates a text-input value against the rem-format rule.
 *
 * @param value - The input value to validate.
 * @param rem   - When true, the value must match `/^\d*\.?\d+rem$/`; otherwise any non-empty
 *                trimmed string is accepted.
 * @returns True if the value is valid.
 */
export function isRemValid(value: string, rem: boolean): boolean {
    if (rem) return REM_RE.test(value.trim());
    return value.trim().length > 0;
}

/** Reactive settings store (Svelte 5 Runes). Single source of truth for GUI and core. */
class SettingsStore {
    /** Reactive settings state (Svelte 5 `$state`). */
    settings = $state<Settings>(structuredClone(DEFAULT_SETTINGS));

    /**
     * Loads settings from GM storage into the reactive state and syncs the observer.
     *
     * @returns The loaded settings (falls back to defaults on error).
     */
    load(): Settings {
        try {
            this.settings = loadSettings();
        } catch (e) {
            console.error("[YT-Tweaks] loadSettings failed — using defaults", e);
            this.settings = structuredClone(DEFAULT_SETTINGS);
        }
        setCurrentSettings(this.settings);
        return this.settings;
    }

    /** Flushes pending live-applies, persists the settings, and re-applies immediately. */
    save(): void {
        flushLiveApply();
        saveSettings(this.settings);
        setCurrentSettings(this.settings);
        applyAllLive(this.settings);
    }

    /**
     * Resets settings to defaults, persists, and applies the clean state.
     *
     * ! Full restore pass required: features that mutated the DOM under the OLD settings
     *   (e.g. autoSyncBadge mode "hidden") would stay mutated after a plain defaults-apply —
     *   flushLiveApply() executes any pending keyed restore, restoreAndRunAll() then restores
     *   EVERYTHING and re-applies from the defaults.
     *
     * @returns The default settings now in effect.
     */
    reset(): Settings {
        const defs = structuredClone(DEFAULT_SETTINGS);
        this.settings = defs;
        setLogLevel(defs.debug.logLevel);
        setCurrentSettings(defs);
        flushLiveApply();
        saveSettings(defs);
        restoreAndRunAll(defs);
        return defs;
    }

    /**
     * Sets a value at a dot-path (e.g. "styling.titleFontSize"), syncs the observer, and
     * schedules a debounced live-apply.
     *
     * @param path  - Dot-notation path into the settings object.
     * @param value - The new value.
     */
    setByPath(path: string, value: unknown): void {
        const parts = path.split(".");
        let o: Record<string, unknown> = this.settings as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
            if (o[parts[i]] === undefined || o[parts[i]] === null) o[parts[i]] = {};
            o = o[parts[i]] as Record<string, unknown>;
        }
        o[parts[parts.length - 1]] = value;
        setCurrentSettings(this.settings);
        validation.revalidate(this.settings);
        scheduleLiveApply(this.settings, path);
    }

    /**
     * Reads a value at a dot-path.
     *
     * @param path - Dot-notation path into the settings object.
     * @returns The value at the path (or undefined if absent).
     */
    getByPath(path: string): unknown {
        return path
            .split(".")
            .reduce<unknown>(
                (o, k) => (o as Record<string, unknown>)[k],
                this.settings as unknown as Record<string, unknown>,
            );
    }

    /**
     * Applies effects immediately (no debounce) for the changed key, with registry-driven
     * restore+rerun for affected features. Used by fast UI controls.
     *
     * @param changedKey - Dot-path of the changed key.
     */
    applyImmediate(changedKey: string): void {
        setCurrentSettings(this.settings);
        // * scheduleLiveApply with the changed key drives the registry's key-based restore+rerun;
        //   for immediate effect we call applyAllLive (CSS) then schedule the restore pass.
        applyAllLive(this.settings);
        scheduleLiveApply(this.settings, changedKey);
    }

    /**
     * Exports the current settings as a pretty-printed JSON string.
     *
     * @returns The settings JSON.
     */
    exportJson(): string {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Imports settings from a JSON string, deep-merging over defaults, and applies.
     *
     * ! Same full restore pass as reset(): DOM mutations from now-disabled features are
     *   reverted (flushLiveApply pending keys + restoreAndRunAll wholesale).
     *
     * @param json - The settings JSON string.
     * @throws {SyntaxError} If the JSON is invalid. Throws for non-object payloads too.
     */
    importJson(json: string): void {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid settings JSON: not an object");
        }
        // * Deep-merge over defaults (broken/missing keys fall back to defaults)
        const merged = deepMergeSettings(DEFAULT_SETTINGS, parsed) as Settings;
        this.settings = merged;
        setLogLevel(merged.debug.logLevel);
        setCurrentSettings(merged);
        flushLiveApply();
        saveSettings(merged);
        restoreAndRunAll(merged);
    }
}

/** Singleton settings store instance, imported across GUI and core. */
export const store = new SettingsStore();
