// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadFixture, fixtureExists } from "./fixture-harness";
import { runAll, resetRegistry } from "../registry";
import { registerAllFeatures } from "../features";
import { DEFAULT_SETTINGS, type Settings } from "../settings";

function makeCtx(settings: Settings): { page: "home"; locale: string; settings: Settings } {
    return { page: "home", locale: "de", settings };
}

// * Fixtures are gitignored (real captured DOM) — skip the whole file on a fresh clone/CI.
describe.skipIf(!fixtureExists("guide-full"))("guide group reorder", () => {
    let settings: Settings;

    beforeEach(() => {
        resetRegistry();
        registerAllFeatures();
        loadFixture("guide-full");
        settings = structuredClone(DEFAULT_SETTINGS);
        settings.guide.enabled = true;
    });

    afterEach(() => {
        resetRegistry();
    });

    it("groups.order moves sections within #sections", () => {
        const container = document.querySelector('[id="guide-renderer"] [id="sections"]') as HTMLElement | null;
        expect(container).toBeTruthy();
        const before = [...container!.children].filter((c) => c.tagName.toLowerCase() === "ytd-guide-section-renderer");
        const beforeGroups = before.map((s) => s.getAttribute("data-yt-tweaks-guide-group") || "(none)");

        // * Reverse the order: system first, then discover, etc.
        settings.guide.entries.groups = {
            hidden: {},
            order: ["system", "discover", "moreFromYT", "myYouTube", "subscriptions", "main"],
        };
        runAll(makeCtx(settings));

        const after = [...container!.children].filter((c) => c.tagName.toLowerCase() === "ytd-guide-section-renderer");
        const afterGroups = after.map((s) => s.getAttribute("data-yt-tweaks-guide-group") || "(none)");
        // * Sanity: the reverse actually changed something (guard against a no-op reorder).
        expect(afterGroups.join(",")).not.toBe(beforeGroups.join(","));

        // * First 6 should match the new order (untracked sections at end).
        expect(afterGroups[0]).toBe("system");
        expect(afterGroups[1]).toBe("discover");
        expect(afterGroups[2]).toBe("moreFromYT");
        expect(afterGroups[3]).toBe("myYouTube");
        expect(afterGroups[4]).toBe("subscriptions");
        expect(afterGroups[5]).toBe("main");
    });

    it("discover group hidden works after fixture fix", () => {
        settings.guide.entries.groups = { hidden: { discover: true }, order: [] };
        runAll(makeCtx(settings));
        const secs = document.querySelectorAll("ytd-guide-section-renderer");
        const discoverSec = [...secs].find((s) => s.getAttribute("data-yt-tweaks-guide-group") === "discover") as
            HTMLElement | undefined;
        expect(discoverSec).toBeTruthy();
        expect(discoverSec?.style.display).toBe("none");
    });

    it("system group hidden works", () => {
        settings.guide.entries.groups = { hidden: { system: true }, order: [] };
        runAll(makeCtx(settings));
        const secs = document.querySelectorAll("ytd-guide-section-renderer");
        const systemSec = [...secs].find((s) => s.getAttribute("data-yt-tweaks-guide-group") === "system") as
            HTMLElement | undefined;
        expect(systemSec).toBeTruthy();
        expect(systemSec?.style.display).toBe("none");
    });
});
