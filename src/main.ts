import { store } from "./lib/stores/settings.svelte";
import { openSettings } from "./lib/app/panel";
import { applyCSS } from "./lib/core/css";
import { detectLocale } from "./lib/core/locale";
import log, { isDebugEnabled, setLogLevel, SCOPES } from "./lib/core/log";
import { readStoredLogLevel } from "./lib/core/settings";
import { setCurrentLocale, startObserver, runAll, applyAllLive } from "./lib/core/observer";
import { getPageCtx, initPageContext, recomputePageCtx } from "./lib/core/page";
import { registerAllFeatures } from "./lib/core/features";
import { captureAllSequential } from "./lib/dev/capture";
import { setTweaksEnabled } from "./lib/core/system-toggle";
import { applyAnonymize, setAnonymize } from "./lib/core/anonymize";
import "./app.css";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Boot — @run-at document-start
// ─────────────────────────────────────────────────────────────────────────────
// * R3 / C5: CSS immediately at document-start (document.head may be null → documentElement
//   fallback in applyCSS). Settings + Locale also immediate, so CSS is generated with saved
//   values. Features register + PageContext initializes BEFORE applyCSS so the registry can
//   generate the feature-driven CSS. Gated by `system.tweaksEnabled` — when disabled, skip CSS +
//   observer. The kill-switch state lives in the settings JSON (migrated from the legacy separate
//   GM key `ytTweaksEnabled`).
//
// ! Log level FIRST: read the persisted level directly from storage, before feature
//   registration and settings load. Otherwise every debug log emitted during boot is dropped
//   by the "silent" default and the first debug session shows nothing.

setLogLevel(readStoredLogLevel());

registerAllFeatures();

const settings = store.load();

// * Defensive re-apply: the loaded settings are the source of truth if the pre-read shape differed.
setLogLevel(settings.debug?.logLevel ?? "silent");

initPageContext(settings, (ctx) => {
    // * SPA navigation changed page or locale → re-detect locale ref + re-run features.
    //   ! Page-dependent CSS (registry picks behavior per page) must be regenerated on
    //   page-change too — runAll() only runs `run` behaviors, not `css`. Without this,
    //   CSS-only features (e.g. startpage-grid) stay stale after a page switch.
    //   ! Reads store.settings LIVE (not the captured boot-time const): reset()/importJson()
    //   REPLACE the settings object, and a stale capture would re-apply old CSS after the
    //   new state was already applied.
    setCurrentLocale(ctx.locale);
    if (store.settings.system.tweaksEnabled) {
        applyAllLive(store.settings);
        runAll();
    }
});
const locale = detectLocale();
setCurrentLocale(locale);

let bootPage = "unknown";
try {
    bootPage = getPageCtx().page;
} catch {
    // * PageContext is initialized above — keep the boot log resilient if that ever changes.
}

log.info(SCOPES.BOOT, "document-start", {
    readyState: document.readyState,
    locale,
    page: bootPage,
    logLevel: settings.debug?.logLevel ?? "silent",
    enabled: settings.system.tweaksEnabled,
});

// * Script-manager diagnostics are only useful when debugging — keep them out of the info line.
if (isDebugEnabled()) {
    const gm = typeof GM_info !== "undefined" ? GM_info : null;
    log.debug(SCOPES.BOOT, "script manager info", {
        scriptHandler: gm?.scriptHandler,
        version_topLevel: gm?.version,
        script_version: gm?.script?.version,
        script_fileURL: gm?.script?.fileURL,
        script_updateURL: gm?.script?.updateURL,
        script_downloadURL: gm?.script?.downloadURL,
    });
}

// * Anonymize layer — boot-time apply (independent of the kill-switch). If saved on, mount the
//   blur `<style>` immediately so a reload with anonymize-on is active before first paint.
if (settings.system.anonymize) {
    try {
        applyAnonymize(true);
    } catch (e) {
        log.error(SCOPES.BOOT, "applyAnonymize failed", e);
    }
}

if (settings.system.tweaksEnabled) {
    try {
        applyCSS(settings);
    } catch (e) {
        log.error(SCOPES.BOOT, "applyCSS failed", e);
    }
} else {
    log.info(SCOPES.BOOT, "tweaks disabled (clean state) — skipping CSS + observer");
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: DOMContentLoaded — initial run + observer start
// ─────────────────────────────────────────────────────────────────────────────

function onDCL(): void {
    const dclLocale = detectLocale();
    setCurrentLocale(dclLocale);
    // * documentElement.lang may have been absent/wrong at document-start — re-detect the
    //   PageContext so features dispatch with the corrected LOCALE_PATTERNS. Notifies (and
    //   re-dispatches) only when the locale actually changed.
    recomputePageCtx();
    log.info(SCOPES.BOOT, "DOMContentLoaded — initial run + observer start", {
        locale: dclLocale,
        enabled: settings.system.tweaksEnabled,
    });
    if (settings.system.tweaksEnabled) {
        runAll();
        startObserver();
    }
    // * Auto-open settings (debug) — async after observer start
    if (settings.debug.autoOpen) {
        setTimeout(() => {
            try {
                openSettings();
            } catch (e) {
                log.error(SCOPES.BOOT, "autoOpen failed", e);
            }
        }, 300);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDCL, { once: true });
} else {
    onDCL();
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Settings-GUI (lazy via GM_registerMenuCommand)
// ─────────────────────────────────────────────────────────────────────────────
// * openSettings/closeSettings from src/lib/app/panel.ts — central panel orchestration.

// * Menu registration — openSettings lazy. Label follows the content locale (German UIs get
//   the German label, everything else English).
GM_registerMenuCommand(locale === "de" ? "Einstellungen" : "Settings", openSettings);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Global enable/disable + anonymize toggles — dev-only TM-menu entries
// ─────────────────────────────────────────────────────────────────────────────
// * Dev-only: the kill-switch + anonymize TM-menu entries are only visible in the dev-build
//   (build:dev). In prod this block is dead-code-eliminated via the __DEV_CAPTURE__ flag.
// * Rationale: end users control both toggles via the System tab in the settings panel (prod);
//   the TM-menu entries are a convenience for fixture-capture sessions (clean state).
// * The kill-switch state lives in `system.tweaksEnabled` (settings JSON). `setTweaksEnabled`
//   persists immediately (store.save) + applies the effect (observer start/stop, CSS, restoreAll).
// * The anonymize state lives in `system.anonymize`. `setAnonymize` persists + applies.
// * ! Tampermonkey can't update existing command labels — the label reflects the state at
//   registration time; reload the page for the label to flip.

if (__DEV_CAPTURE__) {
    const tweaksEnabledNow = Boolean(store.getByPath("system.tweaksEnabled"));
    GM_registerMenuCommand(`${tweaksEnabledNow ? "Disable" : "Enable"} Tweaks`, () => {
        setTweaksEnabled(!tweaksEnabledNow);
        alert(
            `Tweaks ${!tweaksEnabledNow ? "enabled" : "disabled (clean state)"}. Reload the page for a full clean state + TM-menu label update.`,
        );
    });

    const anonymizeNow = Boolean(store.getByPath("system.anonymize"));
    GM_registerMenuCommand(`${anonymizeNow ? "Disable" : "Enable"} Anonymize`, () => {
        setAnonymize(!anonymizeNow);
        alert(`Anonymize ${!anonymizeNow ? "enabled" : "disabled"}. Reload the page for TM-menu label update.`);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Dev-only — fixture capture (build:dev only, stripped in prod)
// ─────────────────────────────────────────────────────────────────────────────
// ! Gated by __DEV_CAPTURE__ (compile-time). Static import — YouTube's CSP blocks dynamic
//   import(). In prod the import + this block are dead-code-eliminated (if(false) + unused import).
//
// ! Only ONE TM menu entry: "Capture All Fixtures". It runs a batch that navigates to each
//   preset's page via YouTube's SPA navigation (clicking real sidebar links — no reload, so the
//   JS context survives across pages) and auto-downloads every fixture. YouTube's bot detection
//   blocks Playwright-driven capture, so this is the only reliable batch-capture path.
if (__DEV_CAPTURE__) {
    GM_registerMenuCommand("Capture All Fixtures", () => {
        captureAllSequential().catch((e) => log.error(SCOPES.BOOT, "capture-all failed", e));
    });
}
