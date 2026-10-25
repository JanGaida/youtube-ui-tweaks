import type { Feature } from "../feature.types";
import type { PageCtx } from "../page";
import type { WatchPageSettings, WatchDescriptionLines } from "../settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: watch-page feature — ytd-watch-metadata layout tweaks (watch page only)
// ─────────────────────────────────────────────────────────────────────────────
// * CSS: hide member-button, like/dislike block, download button, description
//   line-count override (all pure CSS, re-render-safe !important).
// * JS DOM-pass: hide Share/Save buttons via locale-aware aria-label match
//   (no stable non-localized class — language-dependent, analog LOCALE_PATTERNS),
//   and install a single capture click-listener on `document` that toggles the
//   description expand/collapse (links & buttons excluded). Delegation on `document`
//   survives Polymer re-renders of `#description` (a per-element marker listener was
//   lost on re-render). The observer re-applies the Share/Save marker pass (analog
//   masthead-buttons); the click-fold listener is idempotent (live-ref guard).

const HIDDEN_ATTR = "data-yt-tweaks-watch-hidden";

// * Locale-aware aria-label sets for Share / Save buttons (no stable non-localized
//   class exists). Fallback: "de" (content-fallback analog core/locale.ts).
//   ! When YouTube changes these labels or adds a new GUI language, extend here.
const ACTION_LABELS: Record<string, { share: string[]; save: string[] }> = {
    de: {
        share: ["Teilen"],
        save: ["Zu Playlist hinzufügen", "Speichern"],
    },
    en: {
        share: ["Share"],
        save: ["Save to playlist", "Save"],
    },
};

/** Description line-count → max-height (2rem per line, YT's #snippet line-height). */
const DESC_LINES_HEIGHT: Record<WatchDescriptionLines, string> = {
    "2": "4rem",
    "3": "6rem",
    "4": "8rem",
    "5": "10rem",
};

/**
 * Builds the watch-page CSS rules from the settings slice (pure CSS, re-render-safe).
 *
 * - hideMemberButton → `#sponsor-button` display:none.
 * - hideLikeDislike → `segmented-like-dislike-button-view-model` display:none.
 * - downloadButton "verstecken" → `ytd-download-button-renderer` display:none
 *   (language-independent custom element).
 * - descriptionClickFold → theme-color hover on the expanded description box (CSS) +
 *   capture click-listener on `document` that toggles expand/collapse (JS DOM-pass).
 *   ! The hover rule reuses YT's own `--yt-saturated-raised-background` (the per-video
 *   ambient/theme color) and mirrors YT's native collapsed-hover rule for the expanded
 *   state — no `opacity:1` overlay hack (that produced a full-white, text-hiding box).
 * - descriptionLines → `#snippet` max-height override (skipped for "3" = YT-native).
 *
 * @param slice - The watch-page settings slice.
 * @returns CSS rule strings.
 */
function watchPageCss(slice: unknown): string[] {
    const s = slice as WatchPageSettings;
    if (!s.enabled) return [];
    const rules: string[] = [];
    if (s.hideMemberButton) {
        rules.push(`ytd-watch-metadata #owner #sponsor-button { display: none !important; }`);
    }
    if (s.hideLikeDislike) {
        rules.push(
            `ytd-watch-metadata #actions segmented-like-dislike-button-view-model { display: none !important; }`,
        );
    }
    if (s.downloadButton === "verstecken") {
        rules.push(
            `ytd-watch-metadata #actions #flexible-item-buttons ytd-download-button-renderer { display: none !important; }`,
        );
    }
    // * Share/Save hide: JS pass only sets the marker (below); CSS hides the marked host.
    //   ! Inline display:none gets clobbered by Polymer's style binding on re-render, so the
    //   hide must come from a CSS attribute-selector rule (re-render-safe; marker persists on
    //   the host unless YT replaces the whole element, which the observer re-marks).
    if (s.shareButton === "verstecken" || s.saveButton === "verstecken") {
        rules.push(`yt-button-view-model[${HIDDEN_ATTR}] { display: none !important; }`);
    }
    if (s.descriptionClickFold) {
        // * Mirror YT's native collapsed-hover rule for the expanded state. YT native only
        //   highlights the box when `ytd-watch-metadata[description-collapsed] #description:hover`
        //   (sets background to `--yt-saturated-raised-background`, the per-video ambient/theme
        //   color — e.g. green/red sampled from the thumbnail). The expanded box has no such rule,
        //   so we add the symmetric `:not([description-collapsed])` variant reusing the same
        //   custom property + the same fallback YT uses for the collapsed state.
        //   ! The old approach forced `yt-interaction .stroke/.fill opacity:1` — that showed the
        //   white interaction overlay at full opacity, hiding all text (Bug 1). Reusing YT's own
        //   background custom property keeps text visible and matches the themed color exactly.
        rules.push(
            `ytd-watch-metadata:not([description-collapsed]) #description:hover { background: var(--yt-saturated-raised-background, var(--t7f4f2c6d54836ce0)) !important; }`,
        );
    }
    if (s.descriptionLines !== "3") {
        const h = DESC_LINES_HEIGHT[s.descriptionLines];
        if (h) {
            rules.push(
                `ytd-watch-metadata #description ytd-text-inline-expander #snippet { max-height: ${h} !important; }`,
            );
        }
    }
    return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: DOM-pass — Share/Save hide (locale-aware) + description click-fold
// ─────────────────────────────────────────────────────────────────────────────

// * Single capture click-listener installed on `document` for description click-fold.
//   ! A per-element listener keyed off a marker attribute (the previous approach) was lost every
//   time Polymer re-rendered `#description` (the marker + the listener vanished together), leaving
//   clicks dead in the expanded state until the observer re-ran — an unreliable timing window.
//   Delegating on `document` is re-render-immune (`document` is never replaced by Polymer) and
//   costs one global listener instead of one-per-description. The handler checks whether the click
//   landed inside `ytd-watch-metadata #description` and excludes links/buttons.
let descFoldListener: ((e: Event) => void) | null = null;

/**
 * Resolves the action-label set for a locale (fallback: "de").
 *
 * @param locale - The content locale (e.g. "de", "en").
 * @returns The share/save label arrays.
 */
function resolveLabels(locale: string): { share: string[]; save: string[] } {
    return ACTION_LABELS[locale] ?? ACTION_LABELS.de;
}

/**
 * Marks a button-view-model (via attribute) whose inner button aria-label matches one
 * of the given labels. Hiding is done by a CSS attribute-selector rule (re-render-safe
 * — inline display:none gets clobbered by Polymer's style binding on re-render).
 *
 * @param container - The container to scan within.
 * @param labels    - The accepted aria-label strings.
 */
function hideByAriaLabel(container: Element, labels: string[]): void {
    const labelSet = new Set(labels);
    for (const vm of container.querySelectorAll("yt-button-view-model")) {
        const btn = vm.querySelector("button[aria-label]");
        if (!btn) continue;
        const aria = btn.getAttribute("aria-label") ?? "";
        if (labelSet.has(aria)) {
            vm.setAttribute(HIDDEN_ATTR, "");
        }
    }
}

/**
 * Runs the Share/Save hide pass (Teilen in #top-level-buttons-computed, Speichern in
 * #flexible-item-buttons). Download is CSS-only (language-independent).
 *
 * @param ctx - The page context.
 */
function hideActionButtons(ctx: PageCtx): void {
    const s = ctx.settings.watchPage;
    if (!s.enabled) return;
    if (s.shareButton !== "verstecken" && s.saveButton !== "verstecken") return;
    const labels = resolveLabels(ctx.locale);
    for (const actions of document.querySelectorAll("ytd-watch-metadata #actions")) {
        if (s.shareButton === "verstecken") {
            const top = actions.querySelector("#top-level-buttons-computed");
            if (top) hideByAriaLabel(top, labels.share);
        }
        if (s.saveButton === "verstecken") {
            const flex = actions.querySelector("#flexible-item-buttons");
            if (flex) hideByAriaLabel(flex, labels.save);
        }
    }
}

/**
 * Dispatches a synthetic pointer gesture (pointerdown → pointerup → click) onto a
 * tp-yt-paper-button so Polymer's `on-tap` gesture recognizer fires. A bare
 * `.click()` is ignored by Polymer (it tracks pointer events, not synthetic clicks).
 *
 * @param btn - The tp-yt-paper-button (#expand / #collapse) to tap.
 */
function tapPolymerButton(btn: HTMLElement): void {
    const opts: PointerEventInit = { bubbles: true, cancelable: true, composed: true };
    btn.dispatchEvent(new PointerEvent("pointerdown", opts));
    btn.dispatchEvent(new PointerEvent("pointerup", opts));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
}

/**
 * Installs a single capture click-listener on `document` that toggles the description
 * expand/collapse when a click lands inside `ytd-watch-metadata #description` (links,
 * buttons, text selections, and multi-clicks excluded). Idempotent — re-install is a
 * no-op while the listener is live.
 *
 * ! Delegation on `document` (not a per-`#description` marker listener): Polymer re-renders
 *   `#description` on SPA navigation and metadata updates, which discarded the old per-element
 *   listener together with its marker attribute — clicks then went dead until the observer
 *   re-ran. `document` is never replaced by Polymer, so one listener survives all re-renders.
 * * State detection uses `#description-inline-expander[is-expanded]` (present iff expanded),
 *   not `ytd-watch-metadata[description-collapsed]`: the `is-expanded` attribute lives on the
 *   expander element that Polymer keeps in sync with the toggle, and was confirmed reliable in
 *   the watch-page DOM (the collapsed dump lacked it; the expanded dump had it).
 * * Text-selection guards: (1) a non-collapsed window selection aborts the toggle — a drag
 *   that selects text still fires a click after mouseup, which previously collapsed the box
 *   mid-selection (text could not be copied); (2) `MouseEvent.detail >= 2` (double/triple
 *   click = word/paragraph select) aborts the toggle.
 *
 * @param ctx - The page context.
 */
function installDescriptionClickFold(ctx: PageCtx): void {
    const s = ctx.settings.watchPage;
    if (!s.enabled || !s.descriptionClickFold) return;
    // * Idempotent: a live listener means the pass already ran (e.g. observer re-run).
    if (descFoldListener) return;
    const handler = (e: Event): void => {
        const me = e as MouseEvent;
        const target = me.target as Element | null;
        if (!target || !target.closest) return;
        // * Exclude links, buttons, and role=button elements (toggling only on the background).
        if (target.closest('a, button, tp-yt-paper-button, [role="button"]')) return;
        // * Only act on clicks inside a watch-page description box.
        const desc = target.closest("ytd-watch-metadata #description");
        if (!desc) return;
        // ! Text-selection guard (Bug: drag-select triggered the fold toggle, making
        //   description text uncopyable). A drag that selects text still fires a click
        //   after mouseup — skip when a non-collapsed selection exists anywhere (the
        //   selection may extend beyond the click target, but a click finalizing a
        //   selection never legitimately toggles the box either way).
        if (!window.getSelection()?.isCollapsed) return;
        // * Exclude double/triple clicks (word/paragraph selection) — e.detail counts
        //   sequential clicks; only a single click toggles.
        if (me.detail >= 2) return;
        const expander = desc.querySelector("#description-inline-expander");
        if (!expander) return;
        // * is-expanded present → expanded → tap #collapse; absent → collapsed → tap #expand.
        const expanded = expander.hasAttribute("is-expanded");
        const btn = expanded
            ? (desc.querySelector("tp-yt-paper-button#collapse") as HTMLElement | null)
            : (desc.querySelector("tp-yt-paper-button#expand") as HTMLElement | null);
        if (!btn) return;
        // * tp-yt-paper-button (Polymer on-tap) ignores a bare .click() — it needs a real
        //   pointer gesture (pointerdown → pointerup → click). Dispatch all three in sequence so
        //   Polymer's gesture recognizer fires the toggle.
        //   ! Defer out of the real click's event processing: dispatching the synthetic gesture
        //   synchronously inside this capture handler (while the real click still propagates) leaves
        //   Polymer's gesture recognizer starved — the re-entrant events never fire on-tap, so the
        //   box does not toggle. setTimeout(0) lets the real click finish first, then the gesture
        //   runs cleanly on a quiescent event loop.
        setTimeout(() => tapPolymerButton(btn), 0);
    };
    descFoldListener = handler;
    document.addEventListener("click", handler, true);
}

/**
 * Runs the watch-page DOM pass: Share/Save hide + description click-fold install.
 *
 * @param ctx - The page context.
 */
function watchPageRun(ctx: PageCtx): void {
    hideActionButtons(ctx);
    installDescriptionClickFold(ctx);
}

/**
 * Restores all watch-page DOM mutations: un-hides Share/Save buttons (marker attribute)
 * and detaches the description click-fold listener (single document-level listener).
 */
export function restoreWatchPage(): void {
    // * Un-mark Share/Save button-view-models (CSS rule keyed off the attribute).
    for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
        el.removeAttribute(HIDDEN_ATTR);
    }
    // * Detach the description click-fold listener (delegation on document).
    if (descFoldListener) {
        document.removeEventListener("click", descFoldListener, true);
        descFoldListener = null;
    }
}

/**
 * Watch-page feature: member/like-dislike/download hide (CSS) + share/save hide
 * (locale-aware JS DOM pass) + description click-fold (JS DOM pass) + description
 * line-count (CSS). Watch-page only (`ytd-watch-metadata` exists on /watch).
 *
 * * DOM-Fixture: none captured yet — selectors verified against user-provided
 *   ytd-watch-metadata HTML (2026-08-26; description DOM re-verified 2026-08-27 for the
 *   click-fold hover/click bug fix; selection-guard added 2026-09-12 after the drag-select
 *   copy bug). Share/Save aria-labels are locale-dependent (de/en);
 *   Download is language-independent. Description click-fold toggles via programmatic
 *   #expand/#collapse button click.
 * ~ DECISION-LOG: Share/Save use a JS-pass-set marker attribute + CSS attribute-selector
 *   hide rule (not inline display:none — Polymer's style binding clobbers inline styles on
 *   re-render; an attribute-marker persists and the CSS rule is re-render-safe). aria-label
 *   is locale-dependent → locale map (de/en, fallback de) analog LOCALE_PATTERNS. The
 *   observer re-marks on re-render if YT replaces the button element. Download stays pure
 *   CSS (custom element, no text-match needed). Description click-fold uses a synthetic
 *   pointer gesture (pointerdown→pointerup→click) because tp-yt-paper-button's Polymer
 *   on-tap ignores a bare .click().
 * ~ DECISION-LOG (2026-08-27, click-fold hover/click bug): the click listener was moved from
 *   a per-`#description` marker listener to a single capture listener delegated on `document`.
 *   Polymer re-renders `#description` on SPA nav / metadata updates, discarding the marker +
 *   listener together — clicks went dead until the observer re-ran (unreliable timing). `document`
 *   is never replaced, so one listener survives all re-renders. State detection switched from
 *   `ytd-watch-metadata[description-collapsed]` to `#description-inline-expander[is-expanded]`
 *   (confirmed reliable: present iff expanded). The hover highlight was also fixed: the old
 *   `yt-interaction .stroke/.fill opacity:1` rule showed the white interaction overlay at full
 *   opacity, hiding all text (Bug 1). The new rule mirrors YT's own collapsed-hover background
 *   (`--yt-saturated-raised-background`, the per-video ambient/theme color) for the expanded
 *   state — themed color, text stays visible.
 * ~ DECISION-LOG (2026-09-12, drag-select copy bug): a click ending a text selection also
 *   toggled the fold, so description text could never be marked/copied. Two guards now abort
 *   the toggle: (1) non-collapsed `window.getSelection()` — a drag-select fires a click after
 *   mouseup; (2) `MouseEvent.detail >= 2` — double/triple clicks select word/paragraph.
 *   Selection state was chosen over tracking pointerdown position because it requires no
 *   extra listeners and matches the user intent (select-to-copy) directly.
 */
export const watchPageFeature: Feature = {
    id: "watch-page",
    settingsPath: "watchPage",
    pages: {
        watch: { css: watchPageCss, run: watchPageRun, restore: restoreWatchPage },
    },
    liveApplyKeys: [
        "watchPage.enabled",
        "watchPage.hideMemberButton",
        "watchPage.hideLikeDislike",
        "watchPage.shareButton",
        "watchPage.saveButton",
        "watchPage.downloadButton",
        "watchPage.descriptionClickFold",
        "watchPage.descriptionLines",
    ],
};
