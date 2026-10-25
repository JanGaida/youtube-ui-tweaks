import log from "./log";
import type { GuideVisibility } from "./settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: GuideSidebarStateMachine — FSM for guide sidebar visibility
// ─────────────────────────────────────────────────────────────────────────────
// * Phase 8: the click interceptor is REMOVED. YT's native toggle logic runs through
//   (hamburger click opens/closes the drawer incl. content shift natively).
//   The FSM now only controls the initial state (attribute removal in enter())
//   and observes the guide-persistent-and-visible attribute read-only, to sync
//   its own state with YT's toggle (state-sync, no re-strip).
//
// * hide-forced removes, in addition to guide-persistent-and-visible on ytd-masthead,
//   also opened/persistent on tp-yt-app-drawer#guide → YT's native JS layout collapses
//   the drawer + content shift automatically. The mini-guide is hidden via CSS display:none.
//
// * States:
//   - inactive             → FSM not active (before enter() or after exit()).
//   - default              → YT default, no mutation, no observer.
//   - hide-forced          → attributes removed (masthead + drawer), content collapsed.
//                           No observer (no toggle desired).
//   - hide-override-closed → initially the attribute removed. Observer active (read-only state-sync).
//                           YT's native hamburger click sets the attribute → state→opened.
//   - hide-override-opened → attribute set (by YT or initially). Observer active (read-only).
//                           YT's native hamburger click removes the attribute → state→closed.
//
// * Transition table:
//   enter(mode)         → default|hide-forced|hide-override-closed (depending on mode)
//   attrObserver callback → closed: attr now present → opened. opened: attr now gone → closed.
//   exit()              → stopAttrObserver, state→inactive.

const MASTHEAD_SEL = "ytd-masthead";
const DRAWER_SEL = "tp-yt-app-drawer#guide";
const ATTR = "guide-persistent-and-visible";
const DRAWER_ATTRS = ["opened", "persistent"];

/** FSM states for guide sidebar visibility. */
export type GuideSidebarState =
    "inactive" | "default" | "hide-forced" | "hide-override-closed" | "hide-override-opened";

/**
 * Finite state machine for guide sidebar visibility.
 *
 * Phase 8: pure attribute control (initial setup in enter()) + read-only
 * attribute observer (state-sync). NO click interceptor anymore — YT's native
 * toggle logic runs through and opens/closes the drawer incl. content shift.
 */
export class GuideSidebarStateMachine {
    private state: GuideSidebarState = "inactive";
    private attrObserver: MutationObserver | null = null;

    /** Current state (read-only for tests/debug). */
    get currentState(): GuideSidebarState {
        return this.state;
    }

    /**
     * Enters a mode — switches the state based on the already-resolved `mode`.
     *
     * ! The caller (guide-visibility feature run()) must do the conflict resolution
     *   (hideHamburger=true + hide-override → "hide-forced"). The FSM itself does not know hideHamburger.
     *
     * @param mode - The resolved GuideVisibility value.
     */
    enter(mode: GuideVisibility): void {
        this.exit();
        if (mode === "default") {
            this.state = "default";
            return;
        }
        if (mode === "hide-forced") {
            this.state = "hide-forced";
            this.stripAttr();
            this.stripDrawerAttrs();
            return;
        }
        // * hide-override: remove the attribute initially (guide closed) + start the read-only observer.
        this.state = "hide-override-closed";
        this.stripAttr();
        this.startAttrObserver();
    }

    /**
     * Leaves the FSM — stops the observer, state → inactive.
     *
     * Attributes are NOT re-set (YT resumes the default per media query on mode change).
     */
    exit(): void {
        this.stopAttrObserver();
        this.state = "inactive";
    }

    // ─── Internals ───────────────────────────────────────────────────────────

    /** Removes the guide-persistent-and-visible attribute from <ytd-masthead>. */
    private stripAttr(): void {
        const masthead = document.querySelector<HTMLElement>(MASTHEAD_SEL);
        if (!masthead) return;
        if (masthead.hasAttribute(ATTR)) {
            masthead.removeAttribute(ATTR);
            log.debug("guide-sidebar", `removed ${ATTR}`);
        }
    }

    /**
     * Removes the opened/persistent attributes from <tp-yt-app-drawer#guide>.
     *
     * Triggers YT's native app-drawer layout JS → drawer collapses + content shift.
     */
    private stripDrawerAttrs(): void {
        const drawer = document.querySelector<HTMLElement>(DRAWER_SEL);
        if (!drawer) return;
        for (const a of DRAWER_ATTRS) {
            if (drawer.hasAttribute(a)) {
                drawer.removeAttribute(a);
                log.debug("guide-sidebar", `removed drawer attr ${a}`);
            }
        }
    }

    /**
     * Starts the read-only attribute observer on <ytd-masthead>.
     *
     * Phase 8: sync the state ONLY — no re-stripping anymore. YT's native hamburger toggle
     * sets/removes the attribute; the observer mirrors that into the FSM state:
     *   - hide-override-closed + attr set    → state = hide-override-opened
     *   - hide-override-opened + attr removed → state = hide-override-closed
     */
    private startAttrObserver(): void {
        const masthead = document.querySelector<HTMLElement>(MASTHEAD_SEL);
        if (!masthead) return;
        if (this.attrObserver) this.attrObserver.disconnect();
        this.attrObserver = new MutationObserver(() => this.syncStateFromAttr());
        this.attrObserver.observe(masthead, { attributes: true, attributeFilter: [ATTR] });
    }

    /** Stops the attribute observer. */
    private stopAttrObserver(): void {
        if (this.attrObserver) {
            this.attrObserver.disconnect();
            this.attrObserver = null;
        }
    }

    /**
     * Read-only state sync — reads the attribute and adjusts the FSM state.
     *
     * ! NO attribute manipulation (no re-strip). YT's native toggle may win.
     */
    private syncStateFromAttr(): void {
        const masthead = document.querySelector<HTMLElement>(MASTHEAD_SEL);
        const present = masthead?.hasAttribute(ATTR) ?? false;
        if (this.state === "hide-override-closed" && present) {
            this.state = "hide-override-opened";
            log.debug("guide-sidebar", "state: hide-override-closed → hide-override-opened (attr set by YT)");
        } else if (this.state === "hide-override-opened" && !present) {
            this.state = "hide-override-closed";
            log.debug("guide-sidebar", "state: hide-override-opened → hide-override-closed (attr removed by YT)");
        }
    }
}

/** Singleton instance — used by the guide-visibility feature. */
export const guideSidebarFSM = new GuideSidebarStateMachine();
