import type { PageCtx, PageType } from "./page";
import type { Settings } from "./settings";
import type { Feature, ValidationError, DeepPartial } from "./feature.types";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: FeatureRegistry — dispatches tweaks per page-context
// ─────────────────────────────────────────────────────────────────────────────
// * Replaces observer.runOnce (hardcoded 4 calls), observer.scheduleLiveApply key switch, and
//   css.generateCSS (monolith). Features register once; the registry dispatches run/css/restore
//   based on the current PageCtx.page, with "*" as a page wildcard fallback.

const features: Feature[] = [];

/**
 * Registers a feature. Duplicate ids are rejected.
 *
 * @param f - The feature to register.
 * @throws {Error} If a feature with the same id is already registered.
 */
export function registerFeature(f: Feature): void {
    if (features.some((x) => x.id === f.id)) {
        throw new Error(`Feature already registered: ${f.id}`);
    }
    features.push(f);
    log.debug("registry", `registered feature "${f.id}" (pages: ${Object.keys(f.pages).join(",") || "none"})`);
}

/** Resets the registry (test-only — clears all registered features). */
export function resetRegistry(): void {
    features.length = 0;
}

/**
 * Returns all registered features (for Debug-tab status display and tests).
 *
 * @returns A copy of the feature list.
 */
export function getFeatures(): Feature[] {
    return [...features];
}

/**
 * Resolves the page behavior for a feature on a given page: `pages[page]` or `pages["*"]` fallback.
 *
 * @param f    - The feature.
 * @param page - The current page type.
 * @returns The matching PageBehavior, or undefined if the feature has no behavior for the page.
 */
export function resolveBehavior(f: Feature, page: PageType): Feature["pages"][PageType] | undefined {
    return f.pages[page] ?? f.pages["*"];
}

/**
 * Reads a settings slice at a dot-path.
 *
 * @param settings - The full settings.
 * @param path     - Dot-notation path (e.g. "styling.titleAlign" or "styling" for the whole slice).
 * @returns The value at the path, or undefined.
 */
export function getSlice(settings: Settings, path: string): unknown {
    return path
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], settings as unknown as Record<string, unknown>);
}

/**
 * Runs all features' `run` behaviors for the current page (in registration order).
 *
 * @param ctx - The current page context.
 */
export function runAll(ctx: PageCtx): void {
    for (const f of features) {
        const behavior = resolveBehavior(f, ctx.page);
        if (behavior?.run) {
            try {
                behavior.run(ctx);
            } catch (e) {
                log.error("registry", `feature "${f.id}" run failed`, e);
            }
        }
    }
}

/**
 * Generates the aggregated CSS string from all features' `css` behaviors for the current page.
 *
 * @param settings - The current settings.
 * @param ctx      - The current page context.
 * @returns A newline-joined CSS string.
 */
export function generateCSS(settings: Settings, ctx: PageCtx): string {
    const rules: string[] = [];
    for (const f of features) {
        const behavior = resolveBehavior(f, ctx.page);
        if (behavior?.css) {
            try {
                const slice = getSlice(settings, f.settingsPath);
                rules.push(...behavior.css(slice, ctx));
            } catch (e) {
                log.error("registry", `feature "${f.id}" css failed`, e);
            }
        }
    }
    return rules.join("\n");
}

/**
 * Schedules a debounced live-apply: for each feature whose `liveApplyKeys` contains the changed
 * key, runs its restore (if any) for the current page, then re-runs all features and re-applies
 * CSS. Batches rapid input (typing) into one update after `delayMs`.
 *
 * ! Key matching is PREFIX-based: a changed key matches a registered `liveApplyKeys` entry when
 *   it is equal OR a child path of it ("guide.entries.hidden.<entryId>" matches the registered
 *   "guide.entries.hidden"). Exact equality alone would silently drop every dynamic sub-path
 *   mutation. The timer body additionally re-runs ALL features unconditionally (not only matched
 *   ones) — this unconditional re-run is what makes per-entry guide toggles apply live.
 *
 * @param settings   - The current settings.
 * @param changedKey - The dot-path that changed.
 * @param ctx        - The current page context.
 * @param applyCss   - Callback to apply the generated CSS to the DOM.
 * @param delayMs    - Debounce delay in milliseconds (default 150).
 * @returns A cancel function (clears the pending timer).
 */
export function scheduleLiveApply(
    settings: Settings,
    changedKey: string,
    ctx: PageCtx,
    applyCss: (css: string) => void,
    delayMs = 150,
): () => void {
    if (liveApplyTimer) clearTimeout(liveApplyTimer);
    pendingCtx = ctx;
    pendingSettings = settings;
    pendingKeys.add(changedKey);
    liveApplyTimer = setTimeout(() => {
        liveApplyTimer = null;
        const s = pendingSettings;
        const c = pendingCtx;
        const keys = pendingKeys;
        pendingSettings = null;
        pendingCtx = null;
        pendingKeys = new Set();
        if (!s || !c) return;
        executeLiveApply(s, c, keys, applyCss);
    }, delayMs);
    return () => {
        if (liveApplyTimer) {
            clearTimeout(liveApplyTimer);
            liveApplyTimer = null;
        }
    };
}

let liveApplyTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: Settings | null = null;
let pendingCtx: PageCtx | null = null;
let pendingKeys = new Set<string>();

/** True when the changed key is equal to, or a dynamic child path of, the registered key. */
function keyMatches(changed: string, registered: string): boolean {
    return changed === registered || changed.startsWith(`${registered}.`);
}

/** Runs the restore pass for all features whose liveApplyKeys match one of the changed keys. */
function restoreForKeySet(keys: Set<string>, ctx: PageCtx): void {
    for (const f of features) {
        const matched = f.liveApplyKeys.some((reg) => {
            for (const k of keys) {
                if (keyMatches(k, reg)) return true;
            }
            return false;
        });
        if (!matched) continue;
        const behavior = resolveBehavior(f, ctx.page);
        if (behavior?.restore) {
            try {
                behavior.restore();
            } catch (e) {
                log.error("registry", `feature "${f.id}" restore failed`, e);
            }
        }
    }
}

/** Full live-apply pass: matched restores → CSS re-apply → unconditional feature re-run. */
function executeLiveApply(settings: Settings, ctx: PageCtx, keys: Set<string>, applyCss: (css: string) => void): void {
    restoreForKeySet(keys, ctx);
    const nextCtx = { ...ctx, settings };
    applyCss(generateCSS(settings, nextCtx));
    runAll(nextCtx);
}

/**
 * Flushes any pending debounced live-apply immediately — by EXECUTING it, not discarding it.
 *
 * ! A pending restore pass must not be dropped: a feature toggled off within the debounce
 *   window would stay mutated (shortened text, hidden ads) until the next reload. The pending
 *   changed keys decide WHICH features get restored; the CALLER's settings/ctx decide what is
 *   re-applied afterwards (save/import/reset always pass the new state they are about to
 *   persist). With no pending pass, only the CSS is refreshed.
 *
 * @param settings - The current settings.
 * @param ctx      - The current page context.
 * @param applyCss - Callback to apply the generated CSS to the DOM.
 */
export function flushLiveApply(settings: Settings, ctx: PageCtx, applyCss: (css: string) => void): void {
    if (liveApplyTimer) {
        clearTimeout(liveApplyTimer);
        liveApplyTimer = null;
    }
    const keys = pendingKeys;
    const hadPending = pendingSettings !== null;
    pendingSettings = null;
    pendingCtx = null;
    pendingKeys = new Set();
    if (hadPending && keys.size > 0) {
        executeLiveApply(settings, ctx, keys, applyCss);
        return;
    }
    applyCss(generateCSS(settings, ctx));
}

/**
 * Runs restore for a single feature (by id), if it has a behavior for the current page.
 *
 * @param featureId - The feature id.
 * @param ctx       - The current page context.
 */
export function restoreForFeature(featureId: string, ctx: PageCtx): void {
    const f = features.find((x) => x.id === featureId);
    if (!f) return;
    const behavior = resolveBehavior(f, ctx.page);
    if (behavior?.restore) behavior.restore();
}

/**
 * Restores ALL registered features' DOM mutations, regardless of the current page.
 *
 * Iterates every feature and calls each *unique* `restore` function exactly once. Dedup is
 * necessary because page-scoped features (e.g. text-shorten) register the same `restoreText`
 * under multiple `pages[<page>]` entries — without dedup it would run up to 5x.
 *
 * ! Used by the global kill-switch (`system.tweaksEnabled=false`): restore-Fns are all
 *   marker-based + global, so no PageCtx is required (unlike `runAll`, which needs the current
 *   page to pick the right `run`/`css` behavior). All markers (`[data-yt-tweaked-*]`,
 *   `[data-yt-tweaks-*]`, `.yt-tweaks-*`) are removed, returning the DOM to YouTube's original
 *   state. The anonymize layer's `<style>` is NOT touched (independent feature).
 */
export function restoreAll(): void {
    const seen = new Set<() => void>();
    for (const f of features) {
        for (const behavior of Object.values(f.pages)) {
            const restore = behavior?.restore;
            if (restore && !seen.has(restore)) {
                seen.add(restore);
                try {
                    restore();
                } catch (e) {
                    log.error("registry", `feature "${f.id}" restoreAll failed`, e);
                }
            }
        }
    }
}

/**
 * Validates the full settings by aggregating every feature's `validate` over its slice.
 *
 * @param settings - The current settings.
 * @returns An array of validation errors (empty if all valid).
 */
export function validateSettings(settings: Settings): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const f of features) {
        if (!f.validate) continue;
        const slice = getSlice(settings, f.settingsPath);
        try {
            errors.push(...f.validate(slice));
        } catch (e) {
            errors.push({ path: f.settingsPath, message: `validator threw: ${String(e)}` });
        }
    }
    return errors;
}

/**
 * Composes default settings by deep-merging each feature's `defaults` slice into a base.
 *
 * ! Phase 1: the central Settings interface remains the source of truth. Feature defaults are
 *   merged on top of the provided base; the base should be the explicit DEFAULT_SETTINGS. This
 *   keeps full type-safety while letting features own their default values.
 *
 * @param base - The base defaults (typically DEFAULT_SETTINGS).
 * @returns Composed defaults (base overridden by feature defaults).
 */
export function composeDefaults(base: Settings): Settings {
    let out = structuredClone(base);
    for (const f of features) {
        if (!f.defaults) continue;
        out = deepMergeSettings(out, f.defaults);
    }
    return out;
}

/**
 * Deep-merges a partial source into a target settings object (recursive; objects merge, arrays
 * and scalars overwrite).
 *
 * @param target - The target settings.
 * @param source - The partial source to merge in.
 * @returns The merged settings.
 */
function deepMergeSettings(target: Settings, source: DeepPartial<Settings>): Settings {
    const t = target as unknown as Record<string, unknown>;
    const s = source as unknown as Record<string, unknown>;
    for (const key of Object.keys(s)) {
        const sv = s[key];
        const tv = t[key];
        if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
            t[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
        } else if (sv !== undefined) {
            t[key] = sv;
        }
    }
    return t as unknown as Settings;
}

/**
 * Deep-merges a partial source into a target object (recursive, objects only; arrays/scalars overwrite).
 *
 * @param target - The target object (mutated and returned).
 * @param source - The partial source to merge in.
 * @returns The merged target.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    for (const key of Object.keys(source)) {
        const sv = source[key];
        const tv = target[key];
        if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
            target[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
        } else if (sv !== undefined) {
            target[key] = sv;
        }
    }
    return target;
}
