/**
 * GM_* polyfill for Playwright addInitScript injection.
 *
 * The userscript expects Tampermonkey-provided globals (`GM_getValue`, `GM_setValue`,
 * `GM_registerMenuCommand` — the explicit grants in vite.config.ts; plus `GM_info`,
 * which Tampermonkey provides unconditionally). Playwright has no Tampermonkey —
 * this polyfill provides an in-memory + localStorage-backed equivalent so the
 * script boots.
 *
 * ! GM_addStyle is deliberately NOT polyfilled: the vite-plugin-monkey bundle checks
 *   `typeof GM_addStyle === 'function'` and falls back to appending a <style> element —
 *   the fallback path is fine under Playwright (and gets exercised for free).
 *
 * ! Polyfill is installed via `page.addInitScript` BEFORE the userscript, so the globals
 *   exist at `@run-at document-start` time.
 * ! Settings are persisted to localStorage under the real keys so a captured session
 *   survives reloads (matches Tampermonkey's persistence semantics).
 */

const GM_STORAGE_PREFIX = "ytTweaksGM_";

/** Builds the JS source string injected into the page before the userscript. */
export function buildGmPolyfillInitScript(): string {
    return `
    (function() {
      var PREFIX = ${JSON.stringify(GM_STORAGE_PREFIX)};

      function deserialize(raw, def) {
        if (raw === null || raw === undefined) return def;
        try { return JSON.parse(raw); } catch (e) { return def; }
      }
      function serialize(val) {
        // * Tampermonkey stores strings as-is; we JSON-encode so structured values round-trip.
        //   The real script calls JSON.parse(savedStr) in loadSettings, so JSON is correct.
        return JSON.stringify(val);
      }

      // ! Playwright addInitScript runs before document.documentElement exists. Defer the
      //   localStorage-backed GM_getValue/setValue until a document root is available. The
      //   command queue is safe to register synchronously (pure in-memory).
      window.GM_getValue = function(key, def) {
        var raw;
        try { if (document.documentElement) raw = localStorage.getItem(PREFIX + key); } catch (e) { raw = null; }
        if (raw === null || raw === undefined) return def;
        return deserialize(raw, def);
      };

      window.GM_setValue = function(key, val) {
        try { if (document.documentElement) localStorage.setItem(PREFIX + key, serialize(val)); } catch (e) {}
      };

      window.GM_addStyle = function(css) {
        var el = document.createElement('style');
        el.textContent = css;
        // * document.head is null pre-parse; documentElement is the safe mount.
        var mount = document.head || document.documentElement;
        if (mount) mount.appendChild(el);
        return el;
      };

      // * GM_info stub — AboutTab reads the userscript version from GM_info.script.version
      //   (real Tampermonkey shape; see ADR 0010).
      //   Version is a placeholder; only shape matters under Playwright.
      window.GM_info = { version: "0.0.0-polyfill", scriptHandler: "playwright", script: { version: "0.0.0-polyfill" } };

      // * Registered menu commands — stored so tests/capture can invoke them by label.
      window.__gmCommands = window.__gmCommands || [];
      window.GM_registerMenuCommand = function(label, fn, accessKey) {
        window.__gmCommands.push({ label: label, fn: fn, accessKey: accessKey });
      };
      window.__gmInvoke = window.__gmInvoke || function(label) {
        var entry = window.__gmCommands.find(function(c) { return c.label === label; });
        if (entry) { entry.fn(); return true; }
        return false;
      };

      // ! The toggle menu command calls alert() — block native dialogs so Playwright doesn't
      //   hang on a modal. This is a test-only concern; Tampermonkey shows real dialogs.
      window.alert = function() {};
    })();
    `;
}

/**
 * Invokes a registered GM menu command by label inside the page.
 *
 * @param page    - The Playwright page.
 * @param label   - The exact menu-command label (e.g. "Einstellungen").
 * @returns True if a matching command was found and invoked.
 */
export async function invokeGmCommand(page: import("@playwright/test").Page, label: string): Promise<boolean> {
    return page.evaluate((l) => (window as any).__gmInvoke(l), label);
}
