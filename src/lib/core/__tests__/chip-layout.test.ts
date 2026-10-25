import { describe, it, expect } from "vitest";
import { stackLayoutCss, CHIP_SEL } from "../features/chip-layout";

/**
 * Tests for the shared chip-layout stack helper.
 *
 * Verifies the rule set threads the bar + row selectors correctly for both the home chip bar
 * (`ytd-feed-filter-chip-bar-renderer` + `#chips-content`) and the watch-page related chip bar
 * (`yt-related-chip-cloud-renderer yt-chip-cloud-renderer` + `#container`). The inner IDs
 * (`#scroll-container`, `#chips`, `#left-arrow`, `#right-arrow`) are identical on both.
 */
describe("chip-layout stackLayoutCss", () => {
    it("emits 6 rules", () => {
        expect(stackLayoutCss({ bar: "x", row: "#y" }).length).toBe(6);
    });

    it("threads the bar selector into every rule", () => {
        const rules = stackLayoutCss({ bar: "ytd-feed-filter-chip-bar-renderer", row: "#chips-content" });
        for (const r of rules) {
            expect(r).toContain("ytd-feed-filter-chip-bar-renderer");
        }
    });

    it("sets the bar height to auto (overlap fix)", () => {
        const rules = stackLayoutCss({ bar: "ytd-feed-filter-chip-bar-renderer", row: "#chips-content" });
        expect(rules[0]).toContain("ytd-feed-filter-chip-bar-renderer { height:auto");
    });

    it("uses the row selector in the flex-direction rule", () => {
        const rules = stackLayoutCss({ bar: "ytd-feed-filter-chip-bar-renderer", row: "#chips-content" });
        expect(rules[1]).toContain("#chips-content");
        expect(rules[1]).toContain("flex-direction:column");
    });

    it("includes the core stack declarations", () => {
        const joined = stackLayoutCss({ bar: "x", row: "#y" }).join("\n");
        expect(joined).toContain("height:auto");
        expect(joined).toContain("flex-direction:column");
        expect(joined).toContain("overflow:visible");
        expect(joined).toContain("transform:none");
        expect(joined).toContain("white-space:normal");
        expect(joined).toContain("display:flex");
        expect(joined).toContain("flex-wrap:wrap");
        expect(joined).toContain("display:none");
    });

    it("tightens chip margins for dense spacing", () => {
        const joined = stackLayoutCss({ bar: "x", row: "#y" }).join("\n");
        expect(joined).toContain("margin: 0 4px 4px 0");
    });

    it("hides both arrows scoped to the bar", () => {
        const rules = stackLayoutCss({ bar: "yt-related-chip-cloud-renderer", row: "#container" });
        const joined = rules.join("\n");
        expect(joined).toContain("yt-related-chip-cloud-renderer #left-arrow");
        expect(joined).toContain("yt-related-chip-cloud-renderer #right-arrow");
    });

    it("exports the chip selector", () => {
        expect(CHIP_SEL).toBe("yt-chip-cloud-chip-renderer");
    });
});
