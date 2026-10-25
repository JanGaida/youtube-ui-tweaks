import type { Feature, ValidationError } from "../feature.types";
import type { PageCtx } from "../page";
import type { DimWatchedSettings } from "../settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: dim-watched feature — desaturate + fade watched grid videos
// ─────────────────────────────────────────────────────────────────────────────
// * Detects watched videos = ytd-rich-item-renderer WITH a watched-progress overlay
//   (.ytThumbnailOverlayProgressBarHost). Reads the watch progress from the progress-bar
//   segment width (inline style "width: NN%") and quantizes it into buckets per
//   dimWatched.progressSteps (ADR 0001 marker attribute carries the bucket value).
// * CSS (scoped to the marker) applies, scaled by bucket/100:
//   - grayscale(bucket) on the thumbnail host → partial desaturation for half-watched items
//   - opacity on the thumbnail host → fades the image proportionally
//   - opacity on the metadata container → fades title + meta + avatar proportionally
// * progressSteps "off" = legacy behavior: every watched item gets the full veil
//   (marker "dimmed-100"). Otherwise items below the first step get no veil (marker "skip").
// * brightness preset controls the FULL-veil endpoint — bucket scaling lerps between
//   1 (no dim) and the preset opacity (thumb + text gekoppelt).
// * No overlay div injection needed — pure CSS on the marker-scoped selectors.
// * DOM run pass is idempotent via the marker attribute.

/** Selector for the grid item renderer (regular video lockups, not shorts shelves). */
const ITEM_SELECTOR = "ytd-rich-item-renderer";
/** Selector for the watched-progress overlay — its presence means the video was watched. */
const WATCHED_SELECTOR = ".ytThumbnailOverlayProgressBarHost";
/** Selector for the progress-bar segment — inline style width carries the watch progress (%). */
const PROGRESS_SEGMENT_SELECTOR = ".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment";
/** Selector for the thumbnail host (the rounded thumbnail container). */
const THUMBNAIL_HOST_SELECTOR = ".ytThumbnailViewModelHost";
/** Selector for the metadata container (title + meta + avatar below the thumbnail). */
const METADATA_SELECTOR = ".ytLockupViewModelMetadata";

/** Marker attribute on ytd-rich-item-renderer (idempotency + CSS scoping target). */
const DIM_MARKER_ATTR = "data-yt-tweaks-dim";
/** Marker value prefix for dimmed items — suffix is the quantized bucket percent (e.g. "dimmed-50"). */
const DIM_MARKER_VAL_PREFIX = "dimmed-";

/** Brightness preset → opacity applied to the thumbnail host (lower = more faded). */
export const THUMB_OPACITY: Record<string, number> = {
    subtle: 0.7,
    light: 0.55,
    medium: 0.4,
    strong: 0.25,
};

/** Brightness preset → opacity applied to the metadata container (title + meta + avatar).
 *  Coupled to THUMB_OPACITY: a stronger thumbnail dim fades the text further too. */
export const TEXT_OPACITY: Record<string, number> = {
    subtle: 0.6,
    light: 0.45,
    medium: 0.3,
    strong: 0.15,
};

/** progressSteps enum → step size in percent (quarter = 4 buckets of 25, etc.). */
const STEP_PCT: Record<DimWatchedSettings["progressSteps"], number> = {
    off: 100,
    quarter: 25,
    third: 100 / 3,
    half: 50,
};

/**
 * stepIntensity enum → curve exponent for the bucket factor (bug #5 fix).
 *
 * Linear `bucket/100` made the 25% bucket nearly invisible (25% of the veil). The exponent
 * bends the curve so higher intensities push mid buckets aggressively toward the full veil.
 * Exponents BELOW 1 raise mid buckets (roots, not powers — a power curve would darken mid
 * buckets even further, the opposite of the intent):
 *   subtle: x^1 ≈ linear (gentle graduation)
 *   medium: x^0.5 — square ROOT (0.25-bucket → 0.5 of the veil, 0.5-bucket → 0.71)
 *   strong: x^0.34 — cube ROOT-ish (0.25-bucket → 0.65 of the veil)
 * Factor = (bucket/100) ^ exponent, applied to the dim DEPTH (1 - opacity), so 100% buckets
 * always keep the exact brightness-preset endpoint. Tests pin the root behavior
 * (dim-watched.test.ts: bucketFactor uses Math.sqrt for medium).
 */
const STEP_INTENSITY_EXP: Record<DimWatchedSettings["stepIntensity"], number> = {
    subtle: 1,
    medium: 0.5,
    strong: 0.34,
};

/**
 * Bucket factor for the given quantized bucket + intensity setting.
 *
 * factor = (bucket/100) ^ exponent. Exponents < 1 RAISE mid buckets (strong intensity:
 * (0.25)^0.34 ≈ 0.65 of the full veil for the 25% bucket — visible graduation without
 * washing out). The 100% bucket is always 1 (exact preset endpoint).
 *
 * @param bucket    - The quantized bucket percent (0-100).
 * @param intensity - The stepIntensity enum value.
 * @returns The veil depth factor (0-1).
 */
export function bucketFactor(bucket: number, intensity: DimWatchedSettings["stepIntensity"]): number {
    if (bucket >= 100) return 1;
    const x = bucket / 100;
    return Math.pow(x, STEP_INTENSITY_EXP[intensity] ?? STEP_INTENSITY_EXP.medium);
}

/**
 * Quantizes a watch progress (percent) into the bucket value for the given step setting.
 *
 * Downward quantization (D1): `bucket = floor(progress / stepPct) * stepPct` — a 49%-watched
 * video at "half" lands in the 0 bucket (no veil), 81% at "quarter" lands in 75. 100% stays
 * 100 (never exceeds the preset endpoint). Returns 0 for anything below the first step.
 *
 * ! Epsilon guard: float step sizes (third = 33.333…) must not let an exact-multiple progress
 *   fall below its own bucket via float truncation (2 × 33.333… / 33.333… must floor to 2).
 * ! Final floor (not round) keeps marker values stable integers: third buckets are 33/66/100.
 *
 * @param progressPct - The watch progress in percent (0-100) from the progress-bar segment.
 * @param steps       - The progressSteps enum value.
 * @returns The quantized bucket percent (0 | 25 | 33 | 50 | 66 | 75 | 100).
 */
export function quantizeProgress(progressPct: number, steps: DimWatchedSettings["progressSteps"]): number {
    if (steps === "off") return 100;
    const stepPct = STEP_PCT[steps];
    const EPSILON = 1e-6;
    const bucket = Math.floor(progressPct / stepPct + EPSILON) * stepPct;
    if (bucket >= 99.995) return 100;
    if (bucket <= 0) return 0;
    return Math.floor(bucket);
}

/**
 * Validates the dim-watched slice: brightness must be a known enum value.
 *
 * @param slice - The dimWatched settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validateDimWatched(slice: unknown): ValidationError[] {
    const s = slice as DimWatchedSettings;
    const errors: ValidationError[] = [];
    if (!Array.from(Object.keys(THUMB_OPACITY)).includes(s.brightness)) {
        errors.push({
            path: "dimWatched.brightness",
            message: "Must be one of: subtle, light, medium, strong",
        });
    }
    if (typeof s.hoverReveal !== "boolean") {
        errors.push({ path: "dimWatched.hoverReveal", message: "Must be a boolean" });
    }
    if (!Array.from(Object.keys(STEP_PCT)).includes(s.progressSteps)) {
        errors.push({ path: "dimWatched.progressSteps", message: "Must be one of: off, quarter, third, half" });
    }
    if (!Array.from(Object.keys(STEP_INTENSITY_EXP)).includes(s.stepIntensity)) {
        errors.push({ path: "dimWatched.stepIntensity", message: "Must be one of: subtle, medium, strong" });
    }
    return errors;
}

/**
 * Reads the watch progress (percent) from a grid item's progress-bar segment inline width.
 *
 * ! `segment.style.width` returns the normalized CSS property value (e.g. "24%") — NOT the
 *   raw attribute string. Match the bare percentage, never "width: NN%".
 *
 * @param item - The ytd-rich-item-renderer element.
 * @returns The progress in percent (0-100), or null when absent/unparseable.
 */
function readProgressPct(item: HTMLElement): number | null {
    const segment = item.querySelector<HTMLElement>(PROGRESS_SEGMENT_SELECTOR);
    if (!segment) return null;
    const m = /^([\d.]+)%$/.exec(segment.style.width.trim());
    if (!m) return null;
    const n = Number.parseFloat(m[1]);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n));
}

/**
 * Processes a single grid item: marks watched items with their dim bucket for CSS dimming,
 * skips unwatched ones.
 *
 * Idempotent via the DIM_MARKER_ATTR — already-processed items are skipped.
 *
 * @param item - The ytd-rich-item-renderer element.
 * @param steps - The progressSteps enum value (bucket quantization).
 */
function processItem(item: HTMLElement, steps: DimWatchedSettings["progressSteps"]): void {
    // * Already processed — skip (idempotency).
    if (item.hasAttribute(DIM_MARKER_ATTR)) return;

    // * Unwatched (no progress-bar overlay) — skip.
    if (!item.querySelector(WATCHED_SELECTOR)) {
        item.setAttribute(DIM_MARKER_ATTR, "skip");
        return;
    }

    // * Shorts shelf items lack the thumbnail host — skip.
    const thumbHost = item.querySelector<HTMLElement>(THUMBNAIL_HOST_SELECTOR);
    if (!thumbHost) {
        item.setAttribute(DIM_MARKER_ATTR, "skip");
        return;
    }

    // * Quantize the watch progress into the dim bucket; below the first step = no veil.
    const progressPct = readProgressPct(item) ?? 100;
    const bucket = quantizeProgress(progressPct, steps);
    if (bucket <= 0) {
        item.setAttribute(DIM_MARKER_ATTR, "skip");
        return;
    }

    item.setAttribute(DIM_MARKER_ATTR, `${DIM_MARKER_VAL_PREFIX}${bucket}`);
}

/**
 * Runs the dim-watched DOM pass: marks all watched grid items with their dim bucket.
 *
 * No-op when `dimWatched.enabled` is false. Idempotent per item via the marker attribute.
 *
 * @param ctx - The page context (provides settings).
 */
function dimRun(ctx: PageCtx): void {
    const cfg = ctx.settings.dimWatched;
    if (!cfg.enabled) return;
    document.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((item) => {
        processItem(item, cfg.progressSteps);
    });
}

/**
 * Restores all processed items: removes dim markers.
 *
 * Called before a re-run on settings change (live-apply) or when the feature is disabled.
 */
export function restoreDimWatched(): void {
    document.querySelectorAll<HTMLElement>(`[${DIM_MARKER_ATTR}]`).forEach((item) => {
        item.removeAttribute(DIM_MARKER_ATTR);
    });
}

/**
 * Lerps between 1 (no dim) and the preset opacity by the intensity-curved bucket factor.
 *
 * Bug #5 fix: the factor is (bucket/100)^exp per stepIntensity — the brightness endpoint
 * (100% bucket) stays exact, mid buckets are raised toward it by the curve. Values are
 * rounded to 3 decimals so the emitted CSS stays short and selector-stable.
 *
 * @param fullOpacity - The preset opacity for a fully-watched item (100% bucket).
 * @param bucket      - The quantized bucket percent (0-100).
 * @param intensity   - The stepIntensity enum value (curve exponent).
 * @returns The effective opacity for the bucket.
 */
function lerpOpacity(fullOpacity: number, bucket: number, intensity: DimWatchedSettings["stepIntensity"]): number {
    const factor = bucketFactor(bucket, intensity);
    return Math.round((1 - factor * (1 - fullOpacity)) * 1000) / 1000;
}

/**
 * Builds the dim-watched CSS rules — scoped to watched items via the marker attribute.
 * Applies grayscale + opacity (scaled by bucket) to the thumbnail host and opacity to the
 * metadata container. One rule set per active bucket (marker exact-match keeps CSS cheap).
 *
 * When `hoverReveal` is enabled, adds `:hover` rules that restore full color + opacity on the
 * hovered item (the gray veil disappears on mouse-over).
 *
 * @param slice - The dimWatched settings slice.
 * @returns CSS rule strings.
 */
function dimCss(slice: unknown): string[] {
    const cfg = slice as DimWatchedSettings;
    if (!cfg.enabled) return [];
    const thumbOpacity = THUMB_OPACITY[cfg.brightness] ?? THUMB_OPACITY.medium;
    const textOpacity = TEXT_OPACITY[cfg.brightness] ?? TEXT_OPACITY.medium;

    // * Buckets to emit: legacy "off" = only the full veil (100). Otherwise the step buckets
    //   above 0 (quarter: 25/50/75/100, third: 33/66/100, half: 50/100). Index-based loop —
    //   float accumulation (b += 33.333…) would overshoot 100 and drop the last bucket.
    const buckets: number[] = [];
    if (cfg.progressSteps === "off") {
        buckets.push(100);
    } else {
        const stepPct = STEP_PCT[cfg.progressSteps];
        const count = Math.round(100 / stepPct);
        for (let i = 1; i <= count; i++) {
            buckets.push(quantizeProgress(i * stepPct, cfg.progressSteps));
        }
    }

    const rules: string[] = [];
    for (const bucket of buckets) {
        const scope = `[${DIM_MARKER_ATTR}="${DIM_MARKER_VAL_PREFIX}${bucket}"]`;
        const thumbEff = lerpOpacity(thumbOpacity, bucket, cfg.stepIntensity);
        const textEff = lerpOpacity(textOpacity, bucket, cfg.stepIntensity);
        // * Grayscale follows the same intensity curve (bug #5): mid buckets keep visible
        //   desaturation instead of a barely-there 25% gray. Rounded to 3 decimals.
        const grayscale = Math.round(bucketFactor(bucket, cfg.stepIntensity) * 1000) / 1000;
        rules.push(
            // * Thumbnail host: partial grayscale + reduced opacity (faded image, scaled by bucket).
            `${scope} ${THUMBNAIL_HOST_SELECTOR} { filter: grayscale(${grayscale}) !important; opacity: ${thumbEff} !important; }`,
            // * Metadata container (title + meta + avatar): reduced opacity (faded text).
            `${scope} ${METADATA_SELECTOR} { opacity: ${textEff} !important; }`,
        );
        if (cfg.hoverReveal) {
            // * Reveal conditions (either triggers full color + opacity):
            //   1. :hover — cursor over the item (normal case, title hover etc.).
            //   2. :has(.ytSpecTouchFeedbackShapeHovered) — YouTube's own JS-driven hover class.
            //      When the inline preview player (mini-player) runs as a SEPARATE overlay, CSS :hover
            //      breaks (the overlay intercepts pointer events), but YouTube keeps the
            //      ytSpecTouchFeedbackShapeHovered class on the item's touch-feedback-shape — that's
            //      JS-driven and stays set as long as the cursor is logically over the item. This is
            //      the only reliable signal that works while the player overlay is active.
            //
            // * Both directions use instant transitions (0s delay) — only the BASE (non-revealed)
            //   state has the 400ms transition+delay, so the veil fades back slowly when the cursor
            //   leaves or the player stops, bridging brief DOM restructures without flashing.
            //
            // ! Each part of the comma-separated selector list MUST include the full descendant
            //   chain — CSS comma lists split into independent selectors, so the child combinator
            //   (space) does NOT carry over from one list item to the next.
            rules.push(
                // * Base state: slow fade-back (delayed) — only the LEAVE direction is delayed.
                `${scope} ${THUMBNAIL_HOST_SELECTOR} { transition: filter 400ms, opacity 400ms !important; transition-delay: 400ms !important; }`,
                `${scope} ${METADATA_SELECTOR} { transition: opacity 400ms !important; transition-delay: 400ms !important; }`,
                // * Reveal via :hover OR :has(hovered-class) — instant enter. Each selector in the
                //   list carries its own descendant combinator to the thumbnail/metadata target.
                `${scope}:hover ${THUMBNAIL_HOST_SELECTOR}, ${scope}:has(.ytSpecTouchFeedbackShapeHovered) ${THUMBNAIL_HOST_SELECTOR} { filter: none !important; opacity: 1 !important; transition: filter 0s, opacity 0s !important; transition-delay: 0s !important; }`,
                `${scope}:hover ${METADATA_SELECTOR}, ${scope}:has(.ytSpecTouchFeedbackShapeHovered) ${METADATA_SELECTOR} { opacity: 1 !important; transition: opacity 0s !important; transition-delay: 0s !important; }`,
            );
        }
    }
    return rules;
}

/**
 * Dim-watched feature: desaturates + fades thumbnails of watched grid videos.
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (captured 2026-08-09, locale=de)
 *   .ytThumbnailOverlayProgressBarHost → light DOM (watched indicator).
 *   .ytLockupViewModelMetadata → light DOM (title + meta + avatar container).
 * * brightness: opacity preset, gekoppelt (thumbnail opacity + text opacity).
 * ~ DECISION-LOG: replaced the former highlight-unseen feature (tinted unwatched videos).
 *   v1 inverted logic + injected gray overlay div + dimColor dropdown — too complex, grayscale
 *   applied globally (bug: all items B&W). v2 simplified: grayscale(1) + opacity on thumbnail +
 *   opacity on metadata, all scoped to [data-yt-tweaks-dim="dimmed"] marker. No overlay div,
 *   no dimColor, no brightness filter. Pure CSS on marker-scoped selectors.
 */
export const dimWatchedFeature: Feature = {
    id: "dim-watched",
    settingsPath: "dimWatched",
    pages: {
        home: { css: dimCss, run: dimRun, restore: restoreDimWatched },
        subscriptions: { css: dimCss, run: dimRun, restore: restoreDimWatched },
        channel: { css: dimCss, run: dimRun, restore: restoreDimWatched },
    },
    liveApplyKeys: [
        "dimWatched.enabled",
        "dimWatched.brightness",
        "dimWatched.hoverReveal",
        "dimWatched.progressSteps",
        "dimWatched.stepIntensity",
    ],
    defaults: {
        dimWatched: {
            enabled: false,
            brightness: "medium",
            hoverReveal: false,
            progressSteps: "off",
            stepIntensity: "medium",
        },
    },
    validate: validateDimWatched,
};
