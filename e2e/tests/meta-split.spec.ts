import { test, expect } from "@playwright/test";
import { openFixtureWithUserscript, injectGmPolyfill, injectUserscriptAfterLoad } from "../helpers/userscript";

/**
 * Meta-split E2E — verifies the metaLayout:"split" break-element pass against real lockups.
 *
 * Two fixtures:
 * - `home-grid-item.fixture.html` (captured 2026-08-23): OLD row structure — name and
 *   views+date live in SEPARATE metadata rows; the pass must NOT insert breaks there
 *   (anchor would be the row's first child — nothing on line 1 to separate).
 * - `lockup-meta-split.fixture.html` (synthetic, built from the user-reported LIVE DOM
 *   2026-10-24): CURRENT one-row structure (names + views + date mixed in ONE row) —
 *   Fall 1 (long single-channel name), Fall 2 (multi-channel, empty delimiters),
 *   Fall 3 (short reference). This is the structure the pass was built for.
 *
 * Settings are seeded BEFORE boot via the GM polyfill; assertions run against the REAL
 * injected stylesheet (#yt-tweaks-css) and computed geometry in Firefox — mirrors
 * `src/lib/core/__tests__/meta-split.test.ts` with live CSSOM instead of jsdom.
 */

const HOME_FIXTURE = "/home-grid-item.fixture.html";
const SPLIT_FIXTURE = "/lockup-meta-split.fixture.html";
const ROW_SELECTOR = ".ytLockupMetadataViewModelMetadata .ytContentMetadataViewModelMetadataRow";
const BREAK_SELECTOR = ".yt-tweaks-rowbreak";

/** Seeds partial settings and boots the userscript on the given fixture. */
async function openWithSeeds(
    page: import("@playwright/test").Page,
    fixture: string,
    seeds: Record<string, unknown>,
): Promise<void> {
    await injectGmPolyfill(page);
    await page.goto(fixture);
    await page.evaluate((json) => {
        const w = window as any;
        w.GM_setValue("ytTweaksSettings", json);
    }, JSON.stringify(seeds));
    await injectUserscriptAfterLoad(page, false);
}

test.describe("meta-split", () => {
    test("old-structure fixture (separate name/views rows): no break is inserted (mixed or split)", async ({
        page,
    }) => {
        // * The captured home grid has views+date in their OWN metadata row (anchor = first
        //   child → nothing to separate) — the pass must leave those rows untouched.
        await openWithSeeds(page, HOME_FIXTURE, { styling: { metaLayout: "split" } });
        expect(await page.locator(BREAK_SELECTOR).count()).toBe(0);
    });

    test("split (current one-row structure): one break per row, before the leading icon", async ({ page }) => {
        await openWithSeeds(page, SPLIT_FIXTURE, { styling: { metaLayout: "split" } });

        const rows = page.locator(ROW_SELECTOR);
        expect(await rows.count()).toBe(3);

        for (let i = 0; i < 3; i++) {
            const row = rows.nth(i);
            await expect(row.locator(`> ${BREAK_SELECTOR}`)).toHaveCount(1);
            const nextCls = await row
                .locator(`> ${BREAK_SELECTOR} + *`)
                .evaluate((el) => (el.className || "").toString());
            expect(
                nextCls.includes("ytContentMetadataViewModelLeadingIcon"),
                `break must precede the views unit, got "${nextCls}"`,
            ).toBe(true);
        }
    });

    test("split: line-2 companion CSS is live (break box, gap, delimiter displacement)", async ({ page }) => {
        await openWithSeeds(page, SPLIT_FIXTURE, { styling: { metaLayout: "split" } });

        const css = await page.evaluate(() => document.getElementById("yt-tweaks-css")?.textContent ?? "");
        expect(css).toContain(".yt-tweaks-rowbreak { display: block !important; height: 0 !important; }");
        expect(css).toContain("[data-yt-tweaks-views] { margin-inline-end: 16px !important; }");
        expect(css).toContain(
            "[data-yt-tweaks-views] + .ytContentMetadataViewModelDelimiter { display: none !important; }",
        );
        // * Delimiter normalization: YT margin 4px/4px per delimiter → empty multi-channel
        // delimiters rendered a ~8px double-space between the channel names (measured live).
        expect(css).toContain(
            ".ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter { margin: 0 !important; padding: 0 !important; }",
        );
        expect(css).toContain(
            '.ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelDelimiter:empty::before { content: " " !important; }',
        );
    });

    test("split: multi-channel join renders like a single space (computed, Fall 2)", async ({ page }) => {
        await openWithSeeds(page, SPLIT_FIXTURE, { styling: { metaLayout: "split" } });

        const join = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll<HTMLElement>(
                    ".ytLockupMetadataViewModelMetadata .ytContentMetadataViewModelMetadataRow",
                ),
            );
            const multi = rows.find((r) => {
                const texts = r.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText");
                return texts.length >= 4 && r.querySelector(".yt-tweaks-rowbreak"); // * 2 names + views + date
            });
            if (!multi) return { ok: false as const, gap: 0, spaceWidth: 0 };
            const texts = Array.from(multi.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText"));
            const name1 = texts[0];
            const name2 = texts[1];
            // * The join between the two channel names: a normal space at this font
            //   is measured via a probe text node with identical typography.
            const probe = document.createElement("span");
            probe.style.whiteSpace = "pre";
            probe.textContent = " ";
            name1.parentElement!.appendChild(probe);
            const spaceWidth = probe.getBoundingClientRect().width;
            probe.remove();
            return {
                ok: true as const,
                gap: Math.round((name2.getBoundingClientRect().x - name1.getBoundingClientRect().right) * 10) / 10,
                spaceWidth: Math.round(spaceWidth * 10) / 10,
            };
        });
        expect(join.ok, "fixture must contain a multi-channel row with 2 names").toBe(true);
        // * Normalized: the join is ONE space (±1.5px tolerance for font rounding), not the
        //   previous ~8px double-space (delimiter margin 4px/4px).
        expect(Math.abs(join.gap - join.spaceWidth)).toBeLessThanOrEqual(1.5);
    });

    test("split: gap preset (relaxed → 24px) flows into the CSS", async ({ page }) => {
        await openWithSeeds(page, SPLIT_FIXTURE, { styling: { metaLayout: "split", metaStatsGap: "relaxed" } });
        const css = await page.evaluate(() => document.getElementById("yt-tweaks-css")?.textContent ?? "");
        expect(css).toContain("[data-yt-tweaks-views] { margin-inline-end: 24px !important; }");
    });

    test("split: views + date really sit BELOW the channel name (computed geometry)", async ({ page }) => {
        await openWithSeeds(page, SPLIT_FIXTURE, { styling: { metaLayout: "split" } });

        const geometry = await page.evaluate((rowSel) => {
            const rows = Array.from(document.querySelectorAll<HTMLElement>(rowSel));
            type Geo = {
                ok: boolean;
                nameBottom: number;
                viewsTop: number;
                dateTop: number;
                brkTop: number;
                viewsRight: number;
                dateLeft: number;
            };
            return rows.map((row): Geo => {
                const name = row.querySelector<HTMLElement>(".ytContentMetadataViewModelMetadataText");
                const views = row.querySelector<HTMLElement>("[data-yt-tweaks-views]");
                const date = row.querySelector<HTMLElement>("[data-yt-tweaks-date]");
                const brk = row.querySelector<HTMLElement>(".yt-tweaks-rowbreak");
                if (!name || !views || !date || !brk) {
                    return { ok: false, nameBottom: 0, viewsTop: 0, dateTop: 0, brkTop: 0, viewsRight: 0, dateLeft: 0 };
                }
                return {
                    ok: true,
                    nameBottom: Math.round(name.getBoundingClientRect().bottom),
                    viewsTop: Math.round(views.getBoundingClientRect().top),
                    dateTop: Math.round(date.getBoundingClientRect().top),
                    brkTop: Math.round(brk.getBoundingClientRect().top),
                    viewsRight: Math.round(views.getBoundingClientRect().right),
                    dateLeft: Math.round(date.getBoundingClientRect().left),
                };
            });
        }, ROW_SELECTOR);

        expect(geometry).toHaveLength(3);
        for (const g of geometry) {
            expect(g.ok, "each row must contain name + views marker + date marker + break").toBe(true);
            // * Line 2 starts strictly below the channel name's line 1. The break is a
            //   zero-height block — subpixel rounding can place its top a fraction
            //   above the name's descender edge (measured: 464 vs 465) → 1px tolerance.
            expect(g.viewsTop).toBeGreaterThanOrEqual(g.nameBottom);
            expect(g.dateTop).toBeGreaterThanOrEqual(g.nameBottom);
            expect(g.brkTop).toBeGreaterThanOrEqual(g.nameBottom - 1);
            // * Views precede the date on line 2 (constant gap in between).
            expect(g.dateLeft).toBeGreaterThanOrEqual(g.viewsRight);
        }
    });

    test("mixed (default): the current one-row structure stays untouched", async ({ page }) => {
        await openFixtureWithUserscript(page, SPLIT_FIXTURE, false);
        expect(await page.locator(BREAK_SELECTOR).count()).toBe(0);
    });
});
