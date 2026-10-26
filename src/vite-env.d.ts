/// <reference types="svelte" />
/// <reference types="vite/client" />

/**
 * Compile-time build flag: true in `build:dev`, false in `build` (prod).
 *
 * Replaced by Vite `define` with a boolean literal, so code guarded by `if (__DEV_CAPTURE__)`
 * is dead-code-eliminated in production builds. Used to gate the fixture-capture tooling.
 */
declare const __DEV_CAPTURE__: boolean;

/**
 * Compile-time embedded CHANGELOG.md content (ADR 0010).
 *
 * Newline-normalized + BASE64-ENCODED by Vite `define` in vite.config.ts (one compact,
 * non-readable literal in the bundle); `decodeChangelog()` (about-changelog.ts) turns it
 * back into markdown at runtime. The release PR keeps header version and changelog in the
 * same merge, so they cannot drift.
 */
declare const __CHANGELOG_B64__: string;

// * GM_* ambient declarations — vite-plugin-monkey/client types aren't
//   resolvable via triple-slash (package has no `./client` exports map).
//   Declare only the subset we use.
declare const GM_getValue: {
    <T>(key: string, defaultValue: T): T;
    (key: string, defaultValue?: string): string;
};
declare const GM_setValue: {
    (key: string, value: string): void;
};
declare const GM_registerMenuCommand: {
    (name: string, fn: () => void, accessKey?: string): void;
};
// * GM_info needs no explicit @grant (Tampermonkey provides it unconditionally).
//   The subset actually consumed — AboutTab reads the userscript version.
// warn: top-level `version` is OPTIONAL per the Tampermonkey docs and was observed to
//   return the script-handler (extension) version on some TM builds — the authoritative
//   script-version field is the REQUIRED `script.version` (header @version). See ADR 0010.
declare const GM_info: {
    version?: string;
    scriptHandler?: string;
    script?: {
        version: string;
        name?: string;
        header?: string | null;
        fileURL?: string | null;
        updateURL?: string | null;
        downloadURL?: string | null;
    };
};
