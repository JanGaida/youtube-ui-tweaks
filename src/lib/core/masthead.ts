import type { Settings } from "./settings";
import type { IconDef } from "./mastheadIcons";
import {
    HISTORY_ICON,
    SUBSCRIPTIONS_ICON,
    PLAYLISTS_ICON,
    WATCH_LATER_ICON,
    LIKED_VIDEOS_ICON,
    MY_VIDEOS_ICON,
    DOWNLOADS_ICON,
    SETTINGS_ICON,
} from "./mastheadIcons";
import { openSettings } from "../app/panel";
import log from "./log";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Phase 4b — Masthead (Topbar) JS-Mutation
// ─────────────────────────────────────────────────────────────────────────────
// * TWO SEPARATE BARS — completely independent of YT #start/#buttons.
//   Left bar: absolute position on the left next to the logo.
//   Right bar: absolute position on the right next to #buttons.
//   No insertion into existing elements → no Create-button conflict,
//   no Polymer re-render problem, no idempotency loops.
// * JS must handle: notification "when empty" (badge detection) + custom buttons
//   (7 buttons, each "none"|"left"|"right") into the separate bars.
//   SPA-nav via guide-link click.
// * Mutations are marked via data-yt-tweaks-masthead (restore can revert them).

const MASTHEAD_ATTR = "data-yt-tweaks-masthead";
const NOTIF_EMPTY_ATTR = "data-yt-tweaks-notif-empty";
const NOTIFICATION_SELECTOR = "ytd-notification-topbar-button-renderer";
const LEFT_BAR_ID = "yt-tweaks-leftbar";
const RIGHT_BAR_ID = "yt-tweaks-rightbar";

// * Notification-detection: YouTube prepends "(N) " to document.title when N>0 unread
//   notifications exist (e.g. "(1) YouTube"). This regex matches that prefix — far more
//   reliable than scraping the badge DOM (which Polymer re-renders async + unreliably).
const NOTIF_TITLE_RE = /^\(\d+\)\s/;

const NOTIF_EMPTY_CSS = `[${NOTIF_EMPTY_ATTR}] { display: none !important; }`;
let notifEmptyStyleEl: HTMLStyleElement | null = null;

function ensureNotifEmptyStyle(): void {
    if (notifEmptyStyleEl) return;
    notifEmptyStyleEl = document.createElement("style");
    notifEmptyStyleEl.id = "yt-tweaks-notif-empty-style";
    notifEmptyStyleEl.textContent = NOTIF_EMPTY_CSS;
    (document.head || document.documentElement)?.appendChild(notifEmptyStyleEl);
}

// * Notification-empty re-evaluation: only on SPA navigation (URL change), NOT mid-page.
//   If we re-evaluated on every DOM mutation (content observer) or every title change, the bell
//   would be hidden the instant the user reads their notifications (title prefix "(1)" clears
//   while the notification popup is still open) → broken popup rendering. By gating to SPA nav,
//   the bell state is stable for the entire duration of a page view.
let notifEmptyActive = false;
let lastNotifUrl = "";

// * Button definition: href + icon + per-locale labels.
//   Settings button: isSettings=true → click opens the settings panel instead of SPA-nav
//   (href irrelevant).
interface ButtonDef {
    href: string;
    icon: IconDef;
    /** aria-label/title per content locale (en fallback for unknown locales). */
    labels: Record<string, string>;
    isSettings?: boolean;
}

// * Labels are locale-aware (aria-label + tooltip are user-visible): German UIs get German
//   labels, everything else English. Core must NOT import the GUI i18n (Svelte runes live in
//   gui/), so masthead keeps its own minimal table keyed by the PageCtx locale.
const BUTTONS: Record<string, ButtonDef> = {
    history: { href: "/feed/history", icon: HISTORY_ICON, labels: { de: "Verlauf", en: "History" } },
    subscriptions: {
        href: "/feed/subscriptions",
        icon: SUBSCRIPTIONS_ICON,
        labels: { de: "Abos", en: "Subscriptions" },
    },
    playlists: { href: "/feed/playlists", icon: PLAYLISTS_ICON, labels: { de: "Playlists", en: "Playlists" } },
    watchLater: {
        href: "/playlist?list=WL",
        icon: WATCH_LATER_ICON,
        labels: { de: "Später ansehen", en: "Watch later" },
    },
    likedVideos: { href: "/playlist?list=LL", icon: LIKED_VIDEOS_ICON, labels: { de: "Mag ich", en: "Liked videos" } },
    myVideos: { href: "/feed/my_videos", icon: MY_VIDEOS_ICON, labels: { de: "Meine Videos", en: "My videos" } },
    downloads: { href: "/feed/downloads", icon: DOWNLOADS_ICON, labels: { de: "Downloads", en: "Downloads" } },
    // * Settings button: opens the settings panel (openSettings from app/panel), no SPA-nav.
    settings: { href: "", icon: SETTINGS_ICON, labels: { de: "Einstellungen", en: "Settings" }, isSettings: true },
};

/** Resolves a button's label for the content locale (English fallback). */
function buttonLabel(def: ButtonDef, locale: string): string {
    return def.labels[locale] ?? def.labels.en;
}

// * Default button order (fallback when the buttonOrder setting is missing/invalid).
const DEFAULT_BUTTON_ORDER = [
    "history",
    "subscriptions",
    "playlists",
    "watchLater",
    "likedVideos",
    "myVideos",
    "downloads",
    "settings",
] as const;

/**
 * Resolves the effective button order from the buttonOrder setting.
 *
 * Known keys from buttonOrder in saved order, followed by missing default
 * keys (robust against settings migration). Unknown keys are ignored.
 *
 * @param buttonOrder - The settings.styling.masthead.buttonOrder array.
 * @returns The resolved order as an array of known button keys.
 */
function resolveButtonOrder(buttonOrder: string[] | undefined): string[] {
    const known = new Set(Object.keys(BUTTONS));
    const seen = new Set<string>();
    const out: string[] = [];
    if (Array.isArray(buttonOrder)) {
        for (const k of buttonOrder) {
            if (known.has(k) && !seen.has(k)) {
                out.push(k);
                seen.add(k);
            }
        }
    }
    // * Append missing default keys (order from DEFAULT_BUTTON_ORDER).
    for (const k of DEFAULT_BUTTON_ORDER) {
        if (!seen.has(k)) {
            out.push(k);
            seen.add(k);
        }
    }
    return out;
}

/**
 * Detects whether notifications are present by checking document.title for the "(N) " prefix
 * YouTube prepends when there are unread notifications.
 *
 * ! Replaces the old DOM-badge scraping (which was unreliable: Polymer re-renders the badge
 *   asynchronously and the structure varies). The title prefix is set reliably and immediately.
 *
 * @returns True if the title indicates >=1 unread notification.
 */
function notificationHasCount(): boolean {
    return NOTIF_TITLE_RE.test(document.title);
}

function markMasthead(el: HTMLElement, key: string): void {
    el.setAttribute(MASTHEAD_ATTR, key);
}

/**
 * Hides the notification bell when empty, based on document.title detection.
 *
 * * When the title has no "(N) " prefix → notifications empty → hide the bell.
 * * When the title HAS a "(N) " prefix → notifications present → un-hide a previously-hidden bell.
 * * Idempotent: only toggles the NOTIF_EMPTY_ATTR when the state changes.
 *
 * ! Must only be called on SPA navigation (URL change), NOT on every DOM mutation or title
 *   change. Mid-page re-evaluation hides the bell the instant the user reads their notifications
 *   (the title prefix clears while the popup is still open) → broken popup rendering.
 */
function hideNotificationIfEmpty(): void {
    ensureNotifEmptyStyle();
    const hasNotif = notificationHasCount();
    document.querySelectorAll<HTMLElement>(NOTIFICATION_SELECTOR).forEach((el) => {
        const currentlyHidden = el.hasAttribute(NOTIF_EMPTY_ATTR);
        if (!hasNotif && !currentlyHidden) {
            el.setAttribute(NOTIF_EMPTY_ATTR, "");
            markMasthead(el, "notification-empty");
            log.debug("masthead", "notification hidden (empty — title has no count)");
        } else if (hasNotif && currentlyHidden) {
            el.removeAttribute(NOTIF_EMPTY_ATTR);
            log.debug("masthead", "notification shown (title indicates count)");
        }
    });
}

/**
 * SPA-navigation handler for notification-empty re-evaluation.
 *
 * Fires only when the URL path actually changed (ignores query/hash-only changes). This keeps
 * the bell state stable for the entire duration of a page view — the bell is not hidden while
 * the user is reading notifications on the same page.
 */
function onSpaNavReevalNotif(): void {
    if (!notifEmptyActive) return;
    // * Path-only comparison (ignore ?param / #hash churn within the same page).
    let path = "";
    try {
        path = new URL(location.href, "https://www.youtube.com").pathname;
    } catch {
        path = location.pathname;
    }
    if (path === lastNotifUrl) return;
    lastNotifUrl = path;
    hideNotificationIfEmpty();
}

// * Build button — <a> with an SVG built via createElementNS. Trusted-Types-safe.
//   SPA-nav via guide-link click.
function buildMastheadButton(def: ButtonDef, locale: string, buttonSpacing: string): HTMLElement {
    const label = buttonLabel(def, locale);
    const anchor = document.createElement("a");
    anchor.href = def.href;
    anchor.setAttribute("aria-label", label);
    anchor.setAttribute("title", label);
    anchor.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;color:#fff;text-decoration:none;cursor:pointer;margin-left:${buttonSpacing};flex-shrink:0;transition:background .12s;`;

    anchor.addEventListener("mouseenter", () => {
        anchor.style.background = "rgba(255,255,255,0.1)";
    });
    anchor.addEventListener("mouseleave", () => {
        anchor.style.background = "transparent";
    });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("height", "24");
    svg.setAttribute("width", "24");
    svg.setAttribute("viewBox", def.icon.viewBox);
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.style.pointerEvents = "none";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", def.icon.path);
    svg.appendChild(path);
    anchor.appendChild(svg);

    anchor.addEventListener("click", (e) => {
        e.preventDefault();
        if (def.isSettings) {
            openSettings();
            log.debug("masthead", `settings panel opened via masthead button`);
            return;
        }
        const guideLink = document.querySelector<HTMLAnchorElement>(`a.yt-simple-endpoint[href="${def.href}"]`);
        if (guideLink) {
            guideLink.click();
            log.debug("masthead", `${label} navigated via guide-link to ${def.href}`);
        } else {
            window.location.href = def.href;
            log.debug("masthead", `${label} fallback nav to ${def.href}`);
        }
    });

    return anchor;
}

// * Get or create the separate bar — as a flex-child of #container,
//   NOT inserted into #start/#buttons, NOT absolutely positioned.
//   left:  insertBefore(#center) → between #start and #center (flex layout positions it natively).
//   right: insertBefore(#end)    → between #center and #end.
// * Align: which margin side gets the auto trick to pull the bar toward the
//   desired neighbor (against #container's space-between).
//   left:  "logo"   → margin-left:0 (directly at #start/logo), margin-right:auto (pushes #center away)
//          "center" → margin:auto (bar centered between #start and #center)
//          "search" → margin-left:auto, margin-right:0 (at #center/search)
//   right: "buttons"→ margin-left:auto (at #end/Create), margin-right:0
//          "center" → margin:auto
//          "search" → margin-left:0, margin-right:auto (at #center)
function getOrCreateBar(id: string, side: "left" | "right", marginValue: string, align: string): HTMLElement | null {
    let bar = document.getElementById(id);
    if (bar) {
        applyAlign(bar, side, marginValue, align);
        return bar;
    }
    const container = document.querySelector<HTMLElement>("ytd-masthead #container");
    if (!container) return null;
    bar = document.createElement("div");
    bar.id = id;
    bar.style.cssText = "display:flex;align-items:center;flex-shrink:0;";
    markMasthead(bar, "buttons");
    applyAlign(bar, side, marginValue, align);
    const ref =
        side === "left"
            ? document.querySelector<HTMLElement>("ytd-masthead #center")
            : document.querySelector<HTMLElement>("ytd-masthead #end");
    if (ref) {
        container.insertBefore(bar, ref);
    } else {
        container.appendChild(bar);
    }
    return bar;
}

function applyAlign(bar: HTMLElement, side: "left" | "right", marginValue: string, align: string): void {
    bar.style.marginLeft = "";
    bar.style.marginRight = "";
    if (side === "left") {
        if (align === "logo") {
            // * Directly at the logo (#start) — margin-left=spacing, margin-right:auto pushes #center away.
            bar.style.marginLeft = marginValue;
            bar.style.marginRight = "auto";
        } else if (align === "center") {
            // * Centered between #start and #center.
            bar.style.marginLeft = "auto";
            bar.style.marginRight = "auto";
        } else {
            // * "search" — an #center dran.
            bar.style.marginLeft = "auto";
            bar.style.marginRight = marginValue;
        }
    } else {
        if (align === "buttons") {
            // * Directly at #end (Create/avatar) — margin-right=spacing, margin-left:auto pulls right.
            bar.style.marginRight = marginValue;
            bar.style.marginLeft = "auto";
        } else if (align === "center") {
            bar.style.marginLeft = "auto";
            bar.style.marginRight = "auto";
        } else {
            // * "search" — flush against #center.
            bar.style.marginRight = "auto";
            bar.style.marginLeft = marginValue;
        }
    }
}

let lastButtonsHash = "";

function injectMastheadButtons(settings: Settings, locale: string): void {
    const m = settings.styling.masthead;
    const order = resolveButtonOrder(m.buttonOrder);
    // * Hash over button positions + order + spacings + locale → idempotency (prevents
    //   re-inject loops/flicker). The locale is part of the hash so a content-language
    //   switch re-renders the (aria-label/title) labels.
    const mRec = m as unknown as Record<string, unknown>;
    const hash =
        order.map((k) => `${k}:${mRec[`${k}Button`]}`).join("|") +
        `|${order.join(",")}|${m.logoSpacing}|${m.buttonSpacing}|${m.rightSpacing}|${m.leftBarAlign}|${m.rightBarAlign}|${locale}`;
    // * Both bars must exist (they are never removed, only display:none when empty).
    //   One missing → YT destroyed it during SPA-nav → force re-inject.
    const leftExists = document.getElementById(LEFT_BAR_ID);
    const rightExists = document.getElementById(RIGHT_BAR_ID);
    if (hash === lastButtonsHash && leftExists && rightExists) return;
    lastButtonsHash = hash;

    const leftBar = getOrCreateBar(LEFT_BAR_ID, "left", m.logoSpacing, m.leftBarAlign);
    const rightBar = getOrCreateBar(RIGHT_BAR_ID, "right", m.rightSpacing, m.rightBarAlign);
    if (!leftBar || !rightBar) return;

    leftBar.replaceChildren();
    rightBar.replaceChildren();

    for (const key of order) {
        const pos = mRec[`${key}Button`];
        if (pos === "left") {
            leftBar.appendChild(buildMastheadButton(BUTTONS[key], locale, m.buttonSpacing));
        } else if (pos === "right") {
            rightBar.appendChild(buildMastheadButton(BUTTONS[key], locale, m.buttonSpacing));
        }
    }

    // * Hide empty bars (display:none) but do NOT remove them — otherwise the next
    //   idempotency check misses them → re-inject loop.
    leftBar.style.display = leftBar.children.length > 0 ? "flex" : "none";
    rightBar.style.display = rightBar.children.length > 0 ? "flex" : "none";
}

/**
 * Applies masthead JS mutations per the current settings (hide-empty notification, custom
 * buttons). No-op when `styling.masthead.enabled` is false.
 *
 * @param settings - The current settings.
 * @param locale   - The content locale (drives the button aria-labels/tooltips).
 */
export function hideMasthead(settings: Settings, locale: string): void {
    const m = settings.styling.masthead;
    if (!m.enabled) return;
    if (m.hideNotification === "empty") {
        // * Initial evaluation for the current page, then register the SPA-nav re-evaluator.
        //   The bell state is NOT re-evaluated mid-page (every DOM mutation) — only on
        //   navigation. This prevents hiding the bell while the notification popup is open
        //   (the title prefix clears when the user reads notifications, but we don't react
        //   until the user navigates away).
        if (!notifEmptyActive) {
            notifEmptyActive = true;
            lastNotifUrl = "";
            window.addEventListener("yt-navigate-finish", onSpaNavReevalNotif);
            window.addEventListener("popstate", onSpaNavReevalNotif);
        }
        onSpaNavReevalNotif();
    } else {
        if (notifEmptyActive) {
            notifEmptyActive = false;
            window.removeEventListener("yt-navigate-finish", onSpaNavReevalNotif);
            window.removeEventListener("popstate", onSpaNavReevalNotif);
        }
    }
    injectMastheadButtons(settings, locale);
}

/** Restores the masthead: unhides empty notifications and removes injected custom-button bars. */
export function restoreMasthead(): void {
    if (notifEmptyActive) {
        notifEmptyActive = false;
        window.removeEventListener("yt-navigate-finish", onSpaNavReevalNotif);
        window.removeEventListener("popstate", onSpaNavReevalNotif);
    }
    lastNotifUrl = "";
    document.querySelectorAll<HTMLElement>(`[${MASTHEAD_ATTR}]`).forEach((el) => {
        const keys = el.getAttribute(MASTHEAD_ATTR) || "";
        if (keys.includes("notification-empty")) {
            el.removeAttribute(NOTIF_EMPTY_ATTR);
        }
        if (keys.includes("buttons")) {
            el.remove();
        }
        el.removeAttribute(MASTHEAD_ATTR);
    });
    lastButtonsHash = "";
}
