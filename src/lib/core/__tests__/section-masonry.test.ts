import { describe, it, expect } from "vitest";
import { layoutMasonry, MIN_COLUMN, GAP } from "../../gui/navigation/section-masonry";

/**
 * Tests for layoutMasonry (pure Shortest-Column-Packing).
 *
 * Pure-logic (node env) — no DOM. Verifies:
 * - Column count derived from container width (responsive without viewport).
 * - Shortest-column distribution: column heights differ by at most ~1 card height.
 * - Standard GAP spacing between all cards (horizontal + vertical).
 * - Single card takes the full width (column-span replacement).
 */

// * Fits exactly 2 columns: 2 full MIN_COLUMN columns + 1 GAP between them.
const W_2COL = MIN_COLUMN * 2 + GAP;
// * Just barely too narrow for 2 columns.
const W_1COL = MIN_COLUMN * 2 + GAP - 1;

describe("layoutMasonry", () => {
    it("gives 1 column below 2x MIN_COLUMN+GAP", () => {
        const layout = layoutMasonry([{ height: 100 }, { height: 200 }], W_1COL);
        expect(layout.columns).toBe(1);
        // * All cards stacked vertically, GAP vertical.
        expect(layout.positions[1].top).toBe(100 + GAP);
        expect(layout.positions[1].left).toBe(0);
    });

    it("gives 2 columns at exactly 2x (MIN_COLUMN+GAP)", () => {
        const layout = layoutMasonry([{ height: 100 }, { height: 100 }], W_2COL);
        expect(layout.columns).toBe(2);
        expect(layout.positions[0].left).toBe(0);
        expect(layout.positions[1].left).toBe(MIN_COLUMN + GAP);
        expect(layout.positions[0].top).toBe(0);
        expect(layout.positions[1].top).toBe(0);
    });

    it("packs into the shortest column (high variance stays balanced)", () => {
        // * High variance: 1 large + 3 small cards. Sequential CSS-column
        //   would fill [large, small1] and [small2, small3] → here: large goes in
        //   column 0, smalls follow into the shortest column.
        const items = [{ height: 400 }, { height: 50 }, { height: 50 }, { height: 50 }];
        const layout = layoutMasonry(items, W_2COL);

        const col0 = layout.positions.filter((p) => p.left === 0);
        const col1 = layout.positions.filter((p) => p.left > 0);
        // * Balance: column heights may differ by at most ~1 small card height.
        const h0 = col0.at(-1)!.top;
        const h1 = col1.at(-1)!.top;
        expect(Math.abs(h0 - h1)).toBeLessThanOrEqual(400 - 50 + GAP);
    });

    it("always places the next card in the currently shortest column", () => {
        // * 3 cards: 1st → column 0, 2nd → column 1 (both 0), 3rd → column 0/1
        //   depending on height — verify deterministically:
        const layout = layoutMasonry([{ height: 100 }, { height: 100 }, { height: 20 }], W_2COL);
        // * Cards 1+2 fill both columns to 100. Card 3 (height 20) → leftmost
        //   shortest column (tie → leftmost) = column 0.
        expect(layout.positions[2].left).toBe(0);
        expect(layout.positions[2].top).toBe(100 + GAP);
    });

    it("reports totalHeight as tallest column (excl. trailing GAP)", () => {
        const layout = layoutMasonry([{ height: 100 }, { height: 250 }], W_2COL);
        expect(layout.totalHeight).toBe(250);
    });

    it("single card spans full width (column-span replacement)", () => {
        const layout = layoutMasonry([{ height: 120 }], W_2COL);
        expect(layout.positions[0].left).toBe(0);
        expect(layout.positions[0].top).toBe(0);
        expect(layout.positions[0].width).toBe(W_2COL);
        expect(layout.totalHeight).toBe(120);
    });

    it("empty list yields zero height", () => {
        const layout = layoutMasonry([], W_2COL);
        expect(layout.positions).toHaveLength(0);
        expect(layout.totalHeight).toBe(0);
    });

    it("distributes width evenly with GAP between columns", () => {
        const layout = layoutMasonry([{ height: 10 }, { height: 10 }], W_2COL);
        const [p0, p1] = layout.positions;
        expect(p1.left - (p0.left + p0.width)).toBe(GAP);
        expect(p0.width).toBe(MIN_COLUMN);
        expect(p1.width).toBe(MIN_COLUMN);
    });
});
