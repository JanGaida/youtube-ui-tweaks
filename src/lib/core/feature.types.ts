import type { PageCtx, PageType } from "./page";
import type { Settings } from "./settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Feature contracts — registry-driven tweak architecture
// ─────────────────────────────────────────────────────────────────────────────
// * Each Feature declares per-page behaviors (css/run/restore) keyed by PageType. The registry
//   dispatches to the matching behavior for the current page (or "*" fallback). This replaces
//   the hardcoded runOnce body, the live-apply key switch, and the monolithic generateCSS.

/** Per-page behavior of a feature: CSS rules, DOM pass, and optional restore. */
export interface PageBehavior {
    /** Generates CSS rules for this page from the feature's settings slice. */
    css?: (slice: unknown, ctx: PageCtx) => string[];
    /** Runs a DOM mutation pass for this page (e.g. text-shorten, ads-hide). */
    run?: (ctx: PageCtx) => void;
    /** Undoes prior DOM mutations (called before a re-run on settings change). */
    restore?: () => void;
}

/** A validation error tied to a settings dot-path. */
export interface ValidationError {
    /** The settings dot-path that failed validation. */
    path: string;
    /** Human-readable error message. */
    message: string;
}

/** Deep-partial Settings type for feature default slices (merged into DEFAULT_SETTINGS). */
export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** A self-registering tweak feature. */
export interface Feature {
    /** Unique feature id (e.g. "title-align"). */
    id: string;
    /** Root settings dot-path this feature owns (e.g. "styling.titleAlign"). */
    settingsPath: string;
    /** Per-page behaviors; the registry picks `pages[ctx.page]` or `pages["*"]` as fallback. */
    pages: Partial<Record<PageType, PageBehavior>>;
    /** Settings dot-paths that trigger restore+re-run on live-apply (replaces the hardcoded switch). */
    liveApplyKeys: string[];
    /** Optional default slice merged into DEFAULT_SETTINGS by composeDefaults. */
    defaults?: DeepPartial<Settings>;
    /** Optional validator for this feature's settings slice. */
    validate?: (slice: unknown) => ValidationError[];
}
