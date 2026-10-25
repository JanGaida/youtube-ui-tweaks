/// <reference types="svelte" />
/// <reference types="vite/client" />

/**
 * Compile-time build flag: true in `build:dev`, false in `build` (prod).
 *
 * Replaced by Vite `define` with a boolean literal, so code guarded by `if (__DEV_CAPTURE__)`
 * is dead-code-eliminated in production builds. Used to gate the fixture-capture tooling.
 */
declare const __DEV_CAPTURE__: boolean;

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
//   The subset actually consumed — AboutTab reads the userscript version from here.
declare const GM_info: {
    version: string;
};
