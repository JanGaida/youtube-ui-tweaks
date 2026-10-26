import { store } from "./lib/stores/settings.svelte";
import { openSettings } from "./lib/app/panel";
import { applyCSS } from "./lib/core/css";
import { detectLocale } from "./lib/core/locale";
import { setLogLevel } from "./lib/core/log";
import { setCurrentLocale, startObserver, runAll, applyAllLive } from "./lib/core/observer";
import { initPageContext, recomputePageCtx } from "./lib/core/page";
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

registerAllFeatures();

const settings = store.load();
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
let locale = detectLocale();
setCurrentLocale(locale);

try {
    setLogLevel(settings.debug ? settings.debug.logLevel : "info");
} catch (e) {
    console.error("[YT-Tweaks] boot: setLogLevel failed", e);
}

// * Boot diagnostic — the script-manager's own GM_info, unconditional (boot once, not a hot
//   path). Picked fields instead of the raw object: `script.version` is the header @version
//   (the authoritative installed version), the top-level `version` is handler-dependent
//   (TM 5.5.0 was observed to report its own extension version here — ADR 0010), and
//   `script.header` shows the STORED metadata the manager parsed from the install.
const gm = typeof GM_info !== "undefined" ? GM_info : null;
const gmInfo = gm
    ? {
          scriptHandler: gm.scriptHandler,
          version_topLevel: gm.version,
          script_version: gm.script?.version,
          script_header: gm.script?.header,
          script_fileURL: gm.script?.fileURL,
          script_updateURL: gm.script?.updateURL,
          script_downloadURL: gm.script?.downloadURL,
      }
    : null;

console.info(
    `%c[YT-Tweaks]%c INFO %cboot`,
    "color:#ff0000;font-weight:700",
    "color:#44aaff;font-weight:600",
    "color:#aaa;font-style:italic",
    `document-start (readyState=${document.readyState})`,
    {
        locale,
        logLevel: settings.debug ? settings.debug.logLevel : "?",
        enabled: settings.system.tweaksEnabled,
        gm: gmInfo,
    },
);

// * Anonymize layer — boot-time apply (independent of the kill-switch). If saved on, mount the
//   blur `<style>` immediately so a reload with anonymize-on is active before first paint.
if (settings.system.anonymize) {
    try {
        applyAnonymize(true);
    } catch (e) {
        console.error("[YT-Tweaks] boot: applyAnonymize failed", e);
    }
}

if (settings.system.tweaksEnabled) {
    try {
        applyCSS(settings);
    } catch (e) {
        console.error("[YT-Tweaks] boot: applyCSS failed", e);
    }
} else {
    console.info("[YT-Tweaks] boot: tweaks disabled (clean state) — skipping CSS + observer");
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: DOMContentLoaded — initial run + observer start
// ─────────────────────────────────────────────────────────────────────────────

function onDCL(): void {
    locale = detectLocale();
    setCurrentLocale(locale);
    // * documentElement.lang may have been absent/wrong at document-start — re-detect the
    //   PageContext so features dispatch with the corrected LOCALE_PATTERNS. Notifies (and
    //   re-dispatches) only when the locale actually changed.
    recomputePageCtx();
    console.info(
        `%c[YT-Tweaks]%c INFO %cboot`,
        "color:#ff0000;font-weight:700",
        "color:#44aaff;font-weight:600",
        "color:#aaa;font-style:italic",
        `DOMContentLoaded — initial run + observer start (enabled: ${settings.system.tweaksEnabled})`,
    );
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
                console.error("[YT-Tweaks] boot: autoOpen failed", e);
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
        captureAllSequential().catch((e) => console.error("[YT-Tweaks] capture-all failed", e));
    });
}
