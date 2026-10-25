import type { Feature, ValidationError } from "../feature.types";
import type { PageCtx } from "../page";
import type { PreviewDelaySettings } from "../settings";
import log from "../log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: preview-delay feature — delay the inline hover-preview player on grid items
// ─────────────────────────────────────────────────────────────────────────────
// * YouTube's inline preview is a GLOBAL element (`#video-preview`, always in the DOM, hidden
//   until hover). On hover, YT's Polymer logic populates a `<video>` inside it ~86ms after the
//   `ytSpecTouchFeedbackShapeHovered` class flips on (measured 2026-08-28 via live traces).
// * This feature ADDS a configurable delay on top of the native ~86ms — it cannot make the
//   preview appear faster.
//
// * Mechanism (first JS-listener feature in this codebase):
//   1. CSS gate: a dedicated `<style id="yt-tweaks-preview-gate">` injects
//      `#video-preview { visibility: hidden !important; }` — this hides the preview while
//      keeping it in the render tree (the <video> can buffer while invisible). Lifted by the timer.
//   2. JS hover-timer: per-item `pointerenter` listeners (capture phase). On enter, apply the
//      gate + start `setTimeout(delayMs)`. On expiry, REMOVE the gate so the preview is visible.
//   3. NO pointerleave re-arm: the inline preview runs as a SEPARATE overlay that intercepts
//      pointer events once it appears (see the hoverReveal overlay rationale in dim-watched.ts).
//      A pointerleave handler would fire the instant the overlay shows → re-apply the gate →
//      preview vanishes → stuck. Instead, the gate is re-applied on the NEXT pointerenter of
//      any item (in the enter handler).
//
// * Self-managed gate `<style>` (NOT the registry aggregated stylesheet):
//   The registry calls `css()` on every throttled `runAll` pass, which would clobber a
//   gateActive-flag-based approach. Instead, this feature owns a dedicated `<style>` element
//   it injects/removes directly. `css()` returns `[]` — no registry CSS involvement.
//
// ! Idempotency: `run()` is called repeatedly by the throttled MutationObserver. Each item is
//   marker-guarded (`data-yt-tweaks-preview`) so listeners attach only once. `restore()` tears
//   everything down (markers, listeners via WeakMap, gate `<style>`).

/** Selector for the grid item renderer (regular video lockups, not shorts shelves). */
const ITEM_SELECTOR = "ytd-rich-item-renderer";
/** Selector for YouTube's global inline-preview container (always in the DOM, hidden until hover). */
const PREVIEW_SELECTOR = "#video-preview";

/** Marker attribute on ytd-rich-item-renderer (idempotency: listeners attach only once). */
const MARKER_ATTR = "data-yt-tweaks-preview";
/** Marker values: "armed" = listeners attached, gate-ready; "pending" = timer running; "shown" = gate lifted. */
const MARKER_ARMED = "armed";
const MARKER_PENDING = "pending";
const MARKER_SHOWN = "shown";

/** ID of the dedicated gate `<style>` element (separate from the registry stylesheet). */
const GATE_STYLE_ID = "yt-tweaks-preview-gate";
/** The CSS rule that hides the inline preview while the gate is active (kept in render tree). */
const GATE_CSS = `${PREVIEW_SELECTOR} { visibility: hidden !important; }`;

/** Valid delay enum values (ms). 0 = off (native behavior, no gate). */
export const VALID_DELAYS: readonly number[] = [0, 500, 750, 1000, 1250, 1500, 2000, 3000, 5000, 8000, 10000];

// ── Module-level live state ───────────────────────────────────────────────────
// * Tracked listeners per item (for teardown in restore). WeakMap so GC can reclaim detached items.
// * pendingTimers: active timers keyed by item, cleared on restore.
// * gateLifted: true once a timer has fired and the gate was removed (preview visible). Stays
//   true until the next pointerenter re-applies the gate for a fresh delay. Prevents the throttled
//   MutationObserver's run() from re-hiding the preview while it's showing.
const listeners = new WeakMap<HTMLElement, { enter: (e: PointerEvent) => void }>();
const pendingTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
let gateLifted = false;

/**
 * Injects the gate `<style>` (idempotent — no-op if already present).
 */
function applyGate(): void {
    if (document.getElementById(GATE_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = GATE_STYLE_ID;
    el.textContent = GATE_CSS;
    (document.head || document.documentElement)?.appendChild(el);
}

/**
 * Removes the gate `<style>` (idempotent — no-op if absent).
 */
function liftGate(): void {
    document.getElementById(GATE_STYLE_ID)?.remove();
}

/**
 * Validates the preview-delay slice: enabled must be boolean; delayMs must be a known enum value.
 *
 * @param slice - The previewDelay settings slice.
 * @returns Validation errors (empty when all valid).
 */
function validatePreviewDelay(slice: unknown): ValidationError[] {
    const s = slice as PreviewDelaySettings;
    const errors: ValidationError[] = [];
    if (typeof s.enabled !== "boolean") {
        errors.push({ path: "previewDelay.enabled", message: "Must be a boolean" });
    }
    if (!VALID_DELAYS.includes(s.delayMs)) {
        errors.push({ path: "previewDelay.delayMs", message: `Must be one of: ${VALID_DELAYS.join(", ")} (ms)` });
    }
    return errors;
}

/**
 * Arms a single grid item: attaches pointerenter listener (marker-guarded, once).
 *
 * ! No pointerleave re-arm: the inline preview runs as a SEPARATE overlay that intercepts pointer
 *   events once it appears (see the hoverReveal overlay rationale in dim-watched.ts). A pointerleave
 *   handler would fire the instant the overlay shows → re-apply the gate → preview vanishes →
 *   permanently stuck. The gate is re-applied ONLY on the next pointerenter of any item (in the
 *   enter handler below).
 *
 * @param item  - The ytd-rich-item-renderer element.
 * @param delayMs - The delay in ms to wait before lifting the gate on hover.
 */
function armItem(item: HTMLElement, delayMs: number): void {
    // * Already armed — skip (idempotency).
    if (item.hasAttribute(MARKER_ATTR)) return;

    const enter = (): void => {
        // * Clear ALL pending timers, not just this item's: the gate is a single GLOBAL element.
        //   Hover item A (timer running), move to item B: A's timer would fire after A's
        //   remaining delay and lift the gate — B's preview would appear early. Every enter
        //   restarts the delay cleanly.
        for (const t of pendingTimers.values()) clearTimeout(t);
        pendingTimers.clear();
        // * Re-apply the gate on every enter (covers: first hover, AND re-hover after a prior
        //   preview showed + mouse left + came back). The gate must be active during the delay.
        applyGate();
        gateLifted = false;
        item.setAttribute(MARKER_ATTR, MARKER_PENDING);

        const timer = setTimeout(() => {
            pendingTimers.delete(item);
            // * Delay elapsed — lift the gate so the preview becomes visible.
            liftGate();
            gateLifted = true;
            item.setAttribute(MARKER_ATTR, MARKER_SHOWN);
            log.debug("preview-delay", `gate lifted after ${delayMs}ms`);
        }, delayMs);
        pendingTimers.set(item, timer);
    };

    listeners.set(item, { enter });
    item.addEventListener("pointerenter", enter, true);
    item.setAttribute(MARKER_ATTR, MARKER_ARMED);
}

/**
 * Runs the preview-delay listener-attachment pass on all grid items.
 *
 * No-op when `previewDelay.enabled` is false or `delayMs === 0` (off = native behavior).
 * Idempotent per item via the marker attribute.
 *
 * @param ctx - The page context (provides settings).
 */
function previewDelayRun(ctx: PageCtx): void {
    const cfg = ctx.settings.previewDelay;
    if (!cfg.enabled || cfg.delayMs === 0) return;
    // * Apply the gate ONLY if no timer is pending AND the gate isn't already lifted (preview
    //   currently showing). ! The throttled MutationObserver calls run() repeatedly (scrolling/
    //   lazy-load). A blind applyGate() would re-hide the preview AFTER a timer lifted the gate.
    if (!gateLifted && pendingTimers.size === 0) {
        applyGate();
    }
    document.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((item) => {
        armItem(item, cfg.delayMs);
    });
}

/**
 * Restores all preview-delay state: removes markers, listeners, timers, and the gate `<style>`.
 *
 * Called before a re-run on settings change (live-apply) or when the feature is disabled.
 * ~ Note: listeners are stored in a WeakMap; detached/GC'd items are naturally reclaimed. For
 *   items still in the DOM, the marker attribute identifies armed items for explicit cleanup.
 */
export function restorePreviewDelay(): void {
    // * Clear all pending timers.
    for (const timer of pendingTimers.values()) clearTimeout(timer);
    pendingTimers.clear();
    gateLifted = false;

    // * Remove listeners from all currently-marked items still in the DOM.
    document.querySelectorAll<HTMLElement>(`[${MARKER_ATTR}]`).forEach((item) => {
        const l = listeners.get(item);
        if (l) {
            item.removeEventListener("pointerenter", l.enter, true);
            listeners.delete(item);
        }
        item.removeAttribute(MARKER_ATTR);
    });

    // * Remove the gate `<style>`.
    liftGate();
}

/**
 * preview-delay CSS behavior: returns no rules. The gate is managed via a dedicated `<style>`
 * element in run/restore (decoupled from the registry CSS pipeline — see module header).
 *
 * @returns Always an empty array (gate is self-managed, not registry-driven).
 */
function previewDelayCss(): string[] {
    return [];
}

/**
 * Preview-delay feature: delays YouTube's inline hover-preview player by a configurable duration.
 *
 * * DOM-Fixture: __fixtures__/home-grid-item.fixture.html (yt-touch-feedback-shape → hover class).
 * * First JS-listener feature: per-item pointerenter + setTimeout gate control (NO pointerleave —
 *   the preview overlay would instantly re-trigger it; see armItem).
 * * Gate is a self-managed `<style id="yt-tweaks-preview-gate">` (NOT registry CSS) to avoid
 *   the registry re-emitting the gate rule on every throttled observer pass.
 */
export const previewDelayFeature: Feature = {
    id: "preview-delay",
    settingsPath: "previewDelay",
    pages: {
        home: { css: previewDelayCss, run: previewDelayRun, restore: restorePreviewDelay },
        subscriptions: { css: previewDelayCss, run: previewDelayRun, restore: restorePreviewDelay },
        channel: { css: previewDelayCss, run: previewDelayRun, restore: restorePreviewDelay },
    },
    liveApplyKeys: ["previewDelay.enabled", "previewDelay.delayMs"],
    defaults: {
        previewDelay: {
            enabled: false,
            delayMs: 0,
        },
    },
    validate: validatePreviewDelay,
};
