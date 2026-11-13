// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import log, {
    LOG_LEVELS,
    SCOPES,
    getLogLevel,
    getRecentLogs,
    isDebugEnabled,
    nextNavSeq,
    nextRunId,
    resetLoggerState,
    setLogLevel,
    toErrorInfo,
    warnOnce,
    withLogContext,
    type LogRecord,
} from "../log";

/**
 * Logger unit tests — level filtering, console-method mapping, correlation context,
 * error/DOM normalization, warn-once and the ring buffer.
 */
function spyConsole() {
    return {
        debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
        info: vi.spyOn(console, "info").mockImplementation(() => {}),
        warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
        error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
}

let spies: ReturnType<typeof spyConsole>;

/** Sets the level, then clears ring + spy calls so the level-change log doesn't leak into a test. */
function setLevel(label: string): void {
    setLogLevel(label);
    resetLoggerState();
    vi.clearAllMocks();
}

describe("logger", () => {
    beforeEach(() => {
        setLogLevel("silent");
        resetLoggerState();
        spies = spyConsole();
    });

    afterEach(() => {
        setLogLevel("silent");
        resetLoggerState();
        spies.debug.mockRestore();
        spies.info.mockRestore();
        spies.warn.mockRestore();
        spies.error.mockRestore();
    });

    it("exposes the documented severity order", () => {
        expect(LOG_LEVELS.debug).toBeLessThan(LOG_LEVELS.info);
        expect(LOG_LEVELS.info).toBeLessThan(LOG_LEVELS.warn);
        expect(LOG_LEVELS.warn).toBeLessThan(LOG_LEVELS.error);
        expect(LOG_LEVELS.error).toBeLessThan(LOG_LEVELS.silent);
    });

    it("filters messages below the configured level", () => {
        setLevel("warn");
        log.debug(SCOPES.TEXT, "debug");
        log.info(SCOPES.TEXT, "info");
        log.warn(SCOPES.TEXT, "warn");
        log.error(SCOPES.TEXT, "error");

        expect(spies.debug).not.toHaveBeenCalled();
        expect(spies.info).not.toHaveBeenCalled();
        expect(spies.warn).toHaveBeenCalledOnce();
        expect(spies.error).toHaveBeenCalledOnce();
        expect(getRecentLogs()).toHaveLength(2);
    });

    it("uses the matching console method per level", () => {
        setLevel("debug");
        log.debug(SCOPES.RUN, "d");
        log.info(SCOPES.RUN, "i");
        log.warn(SCOPES.RUN, "w");
        log.error(SCOPES.RUN, "e");

        expect(spies.debug).toHaveBeenCalledOnce();
        expect(spies.info).toHaveBeenCalledOnce();
        expect(spies.warn).toHaveBeenCalledOnce();
        expect(spies.error).toHaveBeenCalledOnce();
    });

    it("suppresses everything at silent", () => {
        setLevel("silent");
        log.debug(SCOPES.RUN, "d");
        log.info(SCOPES.RUN, "i");
        log.warn(SCOPES.RUN, "w");
        log.error(SCOPES.RUN, "e");

        expect(spies.debug).not.toHaveBeenCalled();
        expect(spies.info).not.toHaveBeenCalled();
        expect(spies.warn).not.toHaveBeenCalled();
        expect(spies.error).not.toHaveBeenCalled();
        expect(getRecentLogs()).toHaveLength(0);
    });

    it("warns directly for an unknown level and keeps the current level", () => {
        setLevel("info");
        setLogLevel("bogus");

        expect(getLogLevel()).toBe("info");
        expect(spies.warn).toHaveBeenCalledOnce();
        expect(spies.warn.mock.calls[0].join(" ")).toContain("unknown level");
    });

    it("logs a level change only when the new level allows it", () => {
        setLevel("silent");
        setLogLevel("debug");
        const afterUpgrade = getRecentLogs();
        expect(afterUpgrade).toHaveLength(1);
        expect(afterUpgrade[0].scope).toBe(SCOPES.LOG);
        expect(afterUpgrade[0].message).toContain("silent → debug");

        setLogLevel("silent");
        expect(getRecentLogs()).toHaveLength(1);
    });

    it("reports debug only at debug level", () => {
        setLevel("info");
        expect(isDebugEnabled()).toBe(false);
        setLevel("debug");
        expect(isDebugEnabled()).toBe(true);
    });

    it("stamps records with timestamp, sequence and session id", () => {
        setLevel("info");
        log.info(SCOPES.RUN, "a");
        log.info(SCOPES.RUN, "b");

        const [a, b] = getRecentLogs();
        expect(a.ts).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
        expect(b.seq).toBe(a.seq + 1);
        expect(a.ctx.sessionId).toBeTruthy();
        expect(a.ctx.sessionId).toBe(b.ctx.sessionId);
    });

    it("applies and restores correlation context", () => {
        setLevel("debug");
        const runId = nextRunId();

        withLogContext({ runId, page: "home", locale: "de" }, () => {
            log.debug(SCOPES.RUN, "inside");
        });
        log.debug(SCOPES.RUN, "outside");

        const [inside, outside] = getRecentLogs();
        expect(inside.ctx).toMatchObject({ runId, page: "home", locale: "de" });
        expect(outside.ctx.runId).toBeUndefined();
        expect(outside.ctx.page).toBeUndefined();
    });

    it("restores the correlation context when the callback throws", () => {
        setLevel("debug");
        expect(() =>
            withLogContext({ runId: 999 }, () => {
                throw new Error("boom");
            }),
        ).toThrow("boom");

        log.debug(SCOPES.RUN, "after");
        expect(getRecentLogs()[0].ctx.runId).toBeUndefined();
    });

    it("increments run and nav correlation ids", () => {
        const run1 = nextRunId();
        const run2 = nextRunId();
        const nav1 = nextNavSeq();
        const nav2 = nextNavSeq();
        expect(run2).toBe(run1 + 1);
        expect(nav2).toBe(nav1 + 1);
    });

    it("warnOnce emits at most once per scope/key", () => {
        setLevel("debug");
        warnOnce(SCOPES.TEXT, "locale:fr", "no patterns");
        warnOnce(SCOPES.TEXT, "locale:fr", "no patterns");
        warnOnce(SCOPES.TEXT, "locale:es", "no patterns");

        expect(spies.warn).toHaveBeenCalledTimes(2);
    });

    it("warnOnce respects the level filter", () => {
        setLevel("error");
        warnOnce(SCOPES.ADS, "locale:fr", "no patterns");

        expect(spies.warn).not.toHaveBeenCalled();
        expect(getRecentLogs()).toHaveLength(0);
    });

    it("normalizes errors, strings, objects and circular objects", () => {
        const err = new Error("boom");
        const info = toErrorInfo(err);
        expect(info.name).toBe("Error");
        expect(info.message).toBe("boom");
        expect(info.stack).toContain("boom");

        expect(toErrorInfo("plain")).toEqual({ name: "NonError", message: "plain" });

        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => toErrorInfo(circular)).not.toThrow();
        expect(toErrorInfo(circular).name).toBe("NonError");
    });

    it("converts DOM nodes to a node name instead of retaining the element", () => {
        setLevel("debug");
        const div = document.createElement("div");
        log.debug(SCOPES.TEXT, "node", div);

        expect(getRecentLogs()[0].data).toEqual({ node: "DIV" });
    });

    it("keeps at most 500 records (oldest evicted)", () => {
        setLevel("info");
        for (let i = 0; i < 520; i++) log.info(SCOPES.RUN, `m${i}`);

        const logs = getRecentLogs();
        expect(logs).toHaveLength(500);
        expect(logs[0].message).toBe("m20");
        expect(logs[499].message).toBe("m519");
    });

    it("returns a copy of the ring buffer", () => {
        setLevel("info");
        log.info(SCOPES.RUN, "one");

        const copy = getRecentLogs() as LogRecord[];
        copy.length = 0;

        expect(getRecentLogs()).toHaveLength(1);
    });

    it("keeps string data as-is and object data structured", () => {
        setLevel("info");
        log.info(SCOPES.RUN, "tag", "DIV");
        log.info(SCOPES.RUN, "obj", { node: "DIV" });

        const [stringData, objectData] = getRecentLogs();
        expect(stringData.data).toBe("DIV");
        expect(objectData.data).toEqual({ node: "DIV" });
    });
});
