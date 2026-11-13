// ─────────────────────────────────────────────────────────────────────────────
// MARK: Logger
// ─────────────────────────────────────────────────────────────────────────────
// * Levels: debug=0 < info=1 < warn=2 < error=3 < silent=4. Filter via the internal level.
//   The level is runtime-mutable from the System tab (settings.debug.logLevel).
//   "silent" suppresses EVERYTHING emitted through this logger — flip the System tab
//   to debug for development. Raw console calls are forbidden outside this file.
//
// * Every record carries: local timestamp, monotonic seq, level, scope, message,
//   optional structured data and the active correlation context
//   (sessionId / runId / navSeq / page / locale).
// * Records are also kept in a bounded ring buffer (500 entries) for the
//   "copy debug report" action. Only records that pass the level filter are kept.

// ─── Types ───────────────────────────────────────────────────────────────────

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

/**
 * Central scope catalog. New code must use a constant from here instead of a
 * free-form string — otherwise the CLI can't catch typos and logs can't be grouped.
 */
export const SCOPES = {
    BOOT: "boot",
    SETTINGS: "settings",
    PAGE: "page",
    RUN: "run",
    OBSERVER: "observer",
    REGISTRY: "registry",
    CSS: "css",
    TEXT: "text",
    ADS: "ads",
    BADGE: "badge",
    MASTHEAD: "masthead",
    GUIDE: "guide",
    PREVIEW: "preview",
    STARTPAGE: "startpage",
    ANONYMIZE: "anonymize",
    SYSTEM: "system",
    GUI: "gui",
    GLOBAL: "global",
    LOG: "log",
} as const;

/** Logical scope tag for a log message. */
export type LogScope = (typeof SCOPES)[keyof typeof SCOPES];

/** Structured log-data payload attached to a log message. Keep values small and PII-free. */
export interface LogData {
    [key: string]: unknown;
}

/** Ambient correlation context applied to every record while active. */
export interface LogContext {
    sessionId?: string;
    runId?: number;
    navSeq?: number;
    page?: string;
    locale?: string;
}

/** A retained log record (ring buffer, newest last). */
export interface LogRecord {
    ts: string;
    seq: number;
    level: SettingsLogLevel;
    scope: LogScope;
    message: string;
    ctx: LogContext;
    data?: unknown;
}

// ─── State ───────────────────────────────────────────────────────────────────

/** Console-log prefix tag shown in every emitted message. */
export const LOG_TAG = "YT-Tweaks";

const SESSION_ID = Math.random().toString(36).slice(2, 8);

let currentLevel: SettingsLogLevel = "silent";
let seq = 0;
let runSeq = 0;
let navSeq = 0;
let context: LogContext = { sessionId: SESSION_ID };

const RING_MAX = 500;
/** ! Ring records are kept in memory only — never persisted, never transmitted. */
const ring: LogRecord[] = [];
const onceKeys = new Set<string>();

// ─── Context / correlation ──────────────────────────────────────────────────

/** Current settings-facing level. */
export function getLogLevel(): SettingsLogLevel {
    return currentLevel;
}

/** Increments and returns the next observer-run correlation id. */
export function nextRunId(): number {
    return ++runSeq;
}

/** Increments and returns the next navigation correlation id. */
export function nextNavSeq(): number {
    return ++navSeq;
}

/**
 * Runs `fn` with additional correlation context, restoring the previous context afterwards.
 * * Synchronous only — async callbacks must pass their ids explicitly in `data`.
 *
 * @param patch - Context fields to merge on top of the current context.
 * @param fn - The function to run inside the patched context.
 * @returns Whatever `fn` returns.
 */
export function withLogContext<T>(patch: LogContext, fn: () => T): T {
    const prev = context;
    context = { ...context, ...patch };
    try {
        return fn();
    } finally {
        context = prev;
    }
}

/** Returns a copy of the retained records (newest last). */
export function getRecentLogs(): readonly LogRecord[] {
    return ring.slice();
}

/** Test helper: clears the warn-once cache and the ring buffer (level unchanged). */
export function resetLoggerState(): void {
    onceKeys.clear();
    ring.length = 0;
}

// ─── Error / data normalization ─────────────────────────────────────────────

export interface ErrorInfo {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
}

const MAX_STACK = 4000;

function safeString(v: unknown): string {
    if (typeof v === "string") return v;
    try {
        return JSON.stringify(v) ?? String(v);
    } catch {
        return String(v);
    }
}

/**
 * Normalizes any thrown value into a structured, log-safe error shape.
 * The stack trace is truncated — full traces can carry long inline source excerpts.
 */
export function toErrorInfo(e: unknown): ErrorInfo {
    if (e instanceof Error) {
        const info: ErrorInfo = {
            name: e.name,
            message: e.message,
        };
        if (typeof e.stack === "string") {
            info.stack = e.stack.length > MAX_STACK ? `${e.stack.slice(0, MAX_STACK)}…` : e.stack;
        }
        if (e.cause !== undefined) info.cause = toErrorInfo(e.cause);
        return info;
    }
    return { name: "NonError", message: safeString(e).slice(0, 500) };
}

/** Converts DOM nodes and Errors into log-safe values; everything else passes through. */
function normalizeData(data: unknown): unknown {
    if (data instanceof Error) return { error: toErrorInfo(data) };
    if (typeof Node !== "undefined" && data instanceof Node) return { node: data.nodeName };
    return data;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function stamp(): string {
    const d = new Date();
    const p = (n: number, w = 2): string => String(n).padStart(w, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Flattens context + data into a single payload object (keeps console output readable). */
function payload(rec: LogRecord): Record<string, unknown> | undefined {
    const hasData = rec.data !== undefined;
    const hasCtx = Object.keys(rec.ctx).length > 0;
    if (!hasData && !hasCtx) return undefined;
    if (rec.data !== null && typeof rec.data === "object" && !Array.isArray(rec.data)) {
        return { ...rec.ctx, ...(rec.data as Record<string, unknown>) };
    }
    return { ...rec.ctx, ...(hasData ? { data: rec.data } : {}) };
}

const TAG_STYLE = "color:#ff0000;font-weight:700";
const META_STYLE = "color:#aaa;font-style:italic";
const LEVEL_STYLE: Record<LogLevelLabel, string> = {
    debug: "color:#888;font-weight:600",
    info: "color:#44aaff;font-weight:600",
    warn: "color:#ffaa00;font-weight:600",
    error: "color:#ff4444;font-weight:600",
};

/**
 * Writes to the matching console method. Resolved at CALL time (not at module load) so
 * test spies on `console.*` are observed.
 */
function writeConsole(level: LogLevelLabel, args: unknown[]): void {
    const method =
        level === "debug"
            ? console.debug
            : level === "info"
              ? console.info
              : level === "warn"
                ? console.warn
                : console.error;
    method(...args);
}

// ─── Logger ─────────────────────────────────────────────────────────────────

const log = {
    _emit(level: LogLevelLabel, scope: LogScope, msg: string, data?: unknown): void {
        if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
        const rec: LogRecord = {
            ts: stamp(),
            seq: ++seq,
            level,
            scope,
            message: msg,
            ctx: { ...context },
            data: normalizeData(data),
        };
        ring.push(rec);
        if (ring.length > RING_MAX) ring.shift();

        const prefix = `%c[${LOG_TAG}]%c ${level.toUpperCase()} %c${rec.ts} #${rec.seq} %c${scope}`;
        const styles = [TAG_STYLE, LEVEL_STYLE[level], META_STYLE, META_STYLE];
        const extra = payload(rec);
        const args: unknown[] = extra !== undefined ? [prefix, ...styles, msg, extra] : [prefix, ...styles, msg];
        writeConsole(level, args);
    },
    debug(scope: LogScope, msg: string, data?: unknown): void {
        this._emit("debug", scope, msg, data);
    },
    info(scope: LogScope, msg: string, data?: unknown): void {
        this._emit("info", scope, msg, data);
    },
    warn(scope: LogScope, msg: string, data?: unknown): void {
        this._emit("warn", scope, msg, data);
    },
    error(scope: LogScope, msg: string, data?: unknown): void {
        this._emit("error", scope, msg, data);
    },
};

/**
 * Sets the current log level from a label. Unknown labels keep the current level and warn
 * directly on the console — the warning would be swallowed by the (possibly silent) filter.
 *
 * @param label - One of "debug" | "info" | "warn" | "error" | "silent".
 */
export function setLogLevel(label: string): void {
    const lvl = LOG_LEVELS[label as SettingsLogLevel];
    if (lvl === undefined) {
        console.warn(
            `%c[${LOG_TAG}]%c WARN %clog`,
            TAG_STYLE,
            LEVEL_STYLE.warn,
            META_STYLE,
            `unknown level "${label}" — keeping "${currentLevel}"`,
        );
        return;
    }
    const prev = currentLevel;
    currentLevel = label as SettingsLogLevel;
    if (prev !== currentLevel) log.info(SCOPES.LOG, `level ${prev} → ${currentLevel}`);
}

/**
 * Returns true when debug-level messages are currently emitted.
 *
 * * Hot-path guard: callers skip expensive debug-only work (status queries, string
 *   interpolation) when debug is off, instead of building values that `_emit` discards.
 */
export function isDebugEnabled(): boolean {
    return currentLevel === "debug";
}

/**
 * Emits a warning at most once per (scope, key) pair — for expected, repeated conditions
 * (missing locale patterns, missing optional DOM) that would otherwise flood the console.
 */
export function warnOnce(scope: LogScope, key: string, msg: string, data?: unknown): void {
    const k = `${scope}:${key}`;
    if (onceKeys.has(k)) return;
    onceKeys.add(k);
    log.warn(scope, msg, data);
}

export default log;
