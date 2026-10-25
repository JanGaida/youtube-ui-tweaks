// ─────────────────────────────────────────────────────────────────────────────
// MARK: Logger
// ─────────────────────────────────────────────────────────────────────────────
// * Levels: debug=0 < info=1 < warn=2 < error=3 < silent=4. Filter via LOG_LEVEL.
//   LOG_LEVEL is runtime-mutable from the Debug tab (settings.debug.logLevel).
//   "silent" suppresses EVERYTHING (default) — flip the Debug tab to debug for dev.

/**
 * Emitting log levels (methods on the logger). "silent" is settings-only (no
 * `log.silent` method exists — it maps to severity 4, above error).
 */
export type LogLevelLabel = "debug" | "info" | "warn" | "error";

/** Settings-facing log level: the emitting levels plus "silent" (everything off). */
export type SettingsLogLevel = LogLevelLabel | "silent";

/** Numeric severity per label (debug=0 < info=1 < warn=2 < error=3 < silent=4). Used to filter output. */
export const LOG_LEVELS: Record<SettingsLogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};

/** Ordered list of level labels, indexed by numeric severity (used for reverse lookup + GUI options). */
export const LOG_LEVEL_LABELS: SettingsLogLevel[] = ["debug", "info", "warn", "error", "silent"];

/** Current numeric log level. Messages below this severity are suppressed. Mutable at runtime. */
export let LOG_LEVEL: number = LOG_LEVELS.silent;

/** Console-log prefix tag shown in every emitted message. */
export const LOG_TAG = "YT-Tweaks";

/**
 * Sets the current log level from a label string.
 *
 * Unknown labels keep the current level and emit a warning.
 *
 * @param label - One of "debug" | "info" | "warn" | "error" | "silent".
 */
export function setLogLevel(label: string): void {
    const lvl = LOG_LEVELS[label as SettingsLogLevel];
    if (lvl === undefined) {
        log.warn("log", `unknown level "${label}" — keeping ${LOG_LEVEL_LABELS[LOG_LEVEL]}`);
        return;
    }
    LOG_LEVEL = lvl;
}

/**
 * Returns true when debug-level messages are currently emitted.
 *
 * * Hot-path guard: callers skip expensive debug-only work (status queries, string
 *   interpolation) when debug is off, instead of building values that `_emit` discards.
 */
export function isDebugEnabled(): boolean {
    return LOG_LEVELS.debug >= LOG_LEVEL;
}

/** Structured log-data payload attached to a log message (arbitrary key/value). */
interface LogData {
    [key: string]: unknown;
}

/** Logical scope tag for a log message (e.g. "css", "ads", "obs"). */
type LogScope = string;

/**
 * Logger object — emits console messages filtered by the current `LOG_LEVEL`.
 *
 * Each method takes a scope, a message, and optional structured data. Messages are prefixed
 * with a styled tag so they can be visually identified in the YouTube console.
 */
const log = {
    _emit(level: LogLevelLabel, scope: LogScope, msg: string, data?: LogData | unknown): void {
        if (LOG_LEVELS[level] < LOG_LEVEL) return;
        const prefix = `%c[${LOG_TAG}]%c ${level.toUpperCase()} %c${scope}`;
        const styles = [
            "color:#ff0000;font-weight:700",
            `color:${level === "error" ? "#ff4444" : level === "warn" ? "#ffaa00" : level === "info" ? "#44aaff" : "#888"};font-weight:600`,
            "color:#aaa;font-style:italic",
        ];
        if (data !== undefined) console.log(prefix, ...styles, msg, data);
        else console.log(prefix, ...styles, msg);
    },
    debug(scope: LogScope, msg: string, data?: LogData | unknown): void {
        this._emit("debug", scope, msg, data);
    },
    info(scope: LogScope, msg: string, data?: LogData | unknown): void {
        this._emit("info", scope, msg, data);
    },
    warn(scope: LogScope, msg: string, data?: LogData | unknown): void {
        this._emit("warn", scope, msg, data);
    },
    error(scope: LogScope, msg: string, data?: LogData | unknown): void {
        this._emit("error", scope, msg, data);
    },
};

export default log;
