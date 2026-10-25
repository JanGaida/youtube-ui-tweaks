// ─────────────────────────────────────────────────────────────────────────────
// MARK: Section-Masonry — balanced multi-column layout for the settings panel
// ─────────────────────────────────────────────────────────────────────────────
// * Shortest-column packing: each card is placed into the currently SHORTEST
//   column → column heights differ by max. ~1 card height, even with high
//   height variance across cards. Replaces CSS multi-column, whose sequential
//   balancer overflows the right column by >1 card size under variance.
// * No node moves: absolute positioning (width/left/top) on the cards, the
//   container gets a fixed height. DOM order stays intact → scroll-spy
//   ([data-section] observer) + Svelte reactivity + drag-and-drop untouched.
// * Responsive: column count derives from container width (MIN_COLUMN), NOT
//   from the viewport — the panel is user-resizable (30–90 vw), viewport-based
//   breakpoints don't apply. Re-layout via ResizeObserver on the container +
//   cards, MutationObserver on the container (tab switches).

// * Minimum card width per column — identical to the earlier CSS approach
//   (columns: 420px / grid minmax 420px). Below it: 1 column at full width.
export const MIN_COLUMN = 420;
// * Default spacing between all cards (horizontal + vertical), as before via
//   gap/column-gap + margin-bottom.
export const GAP = 10;

/** Card sizes for the packing — heights are measured live, not estimated. */
export interface MasonryItem {
    /** Height in px (offsetHeight, incl. border, excl. margin). */
    height: number;
}

/** Column layout result: position + size per card + container height. */
export interface MasonryLayout {
    /** Per card (index = DOM order): left/top + width, relative to the content box. */
    positions: { left: number; top: number; width: number }[];
    /** Highest occupied column (incl. GAP between cards, excl. container padding). */
    totalHeight: number;
    /** Number of filled columns (1 in the narrow panel / for a single card). */
    columns: number;
}

/** Column count from container width (content box) — responsive without media queries. */
export function computeColumnCount(containerWidth: number): number {
    return Math.max(1, Math.floor((containerWidth + GAP) / (MIN_COLUMN + GAP)));
}

/** Uniform column width (leftover px are distributed across all columns). */
export function computeColumnWidth(containerWidth: number, columns: number): number {
    return (containerWidth - GAP * (columns - 1)) / columns;
}

/**
 * Pure layout function: distributes cards across n columns via shortest-column packing.
 *
 * ! A single card (e.g. About tab) occupies the full container width — equivalent
 *   to the earlier column-span:all / grid-column:1/-1.
 *
 * @param items       Card sizes in DOM order (height in px).
 * @param containerWidth Width of the container's content box in px.
 * @returns Positions (left/top/width) + totalHeight + column count.
 */
export function layoutMasonry(items: MasonryItem[], containerWidth: number): MasonryLayout {
    const columns = computeColumnCount(containerWidth);

    // * Single card → full width (no shortest-column needed).
    if (items.length <= 1) {
        return {
            positions: items.map(() => ({ left: 0, top: 0, width: containerWidth })),
            totalHeight: items[0]?.height ?? 0,
            columns: 1,
        };
    }

    const columnWidth = computeColumnWidth(containerWidth, columns);
    const positions: MasonryLayout["positions"] = [];
    // * Running heights per column (incl. GAP share; the last GAP is subtracted at the end).
    const colHeights = new Array<number>(columns).fill(0);

    for (const item of items) {
        // * Shortest column: index of the lowest column (ties → leftmost).
        let shortest = 0;
        for (let c = 1; c < columns; c++) {
            if (colHeights[c] < colHeights[shortest]) shortest = c;
        }
        positions.push({
            left: shortest * (columnWidth + GAP),
            top: colHeights[shortest],
            width: columnWidth,
        });
        colHeights[shortest] += item.height + GAP;
    }

    // * Total height: highest occupied column; subtract the GAP of each column's last card.
    let totalHeight = 0;
    for (const h of colHeights) {
        const real = h > 0 ? h - GAP : 0;
        if (real > totalHeight) totalHeight = real;
    }
    return { positions, totalHeight, columns };
}

// ─────────────────────────────────────────────────────────────────────────────
// * Svelte action: measures cards + container, applies layoutMasonry, reacts
//   to resize + DOM changes (tab switches change card count/size).
// ─────────────────────────────────────────────────────────────────────────────

/** Cards managed by the action (element children, no text nodes). */
function getCards(container: HTMLElement): HTMLElement[] {
    return Array.from(container.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
}

/**
 * Svelte action for the section list container (App.svelte).
 *
 * - Container becomes position:relative; cards absolute (left/top relative to
 *   the PADDING box → container padding is added to left/top so the CSS
 *   padding (14px 18px) stays visible).
 * - ResizeObserver on the container (panel resize) + cards (height changes, e.g.
 *   i18n switch, select opening) → re-layout coalesced via rAF.
 * - MutationObserver childList on the container (tab switch: Section components
 *   are re-rendered from scratch) → re-layout + observe new cards.
 * - Measurement order: first set the target width (columnWidth) on the cards,
 *   THEN measure offsetHeight — otherwise heights would reflect the PREVIOUS
 *   layout's width (wrong after a column-count change).
 */
export function masonry(node: HTMLElement): { destroy: () => void } {
    node.style.position = "relative";
    let lastLayout: MasonryLayout | null = null;

    const relayout = (): void => {
        const cards = getCards(node);
        const style = getComputedStyle(node);
        const padLeft = parseFloat(style.paddingLeft) || 0;
        const padTop = parseFloat(style.paddingTop) || 0;
        const padBottom = parseFloat(style.paddingBottom) || 0;
        // * Layout width = content box (padding is not part of the card area).
        const containerWidth = node.clientWidth - padLeft - (parseFloat(style.paddingRight) || 0);

        const columns = computeColumnCount(containerWidth);
        const columnWidth = computeColumnWidth(containerWidth, columns);

        // * 1. Set target width (cards may still be absolutely positioned with
        //   stale positions — width determines height, so set width first,
        //   then measure). Reading offsetHeight forces the reflow.
        const items: MasonryItem[] = cards.map((card) => {
            card.style.position = "absolute";
            card.style.width = columnWidth + "px";
            return { height: card.offsetHeight };
        });

        // * 2. Pure packing computation.
        const layout = layoutMasonry(items, containerWidth);

        // * 3. No layout change → no DOM write (flicker-free under observer spam).
        if (
            lastLayout &&
            lastLayout.columns === layout.columns &&
            lastLayout.totalHeight === layout.totalHeight &&
            lastLayout.positions.length === layout.positions.length &&
            lastLayout.positions.every(
                (p, i) => p.top === layout.positions[i].top && p.left === layout.positions[i].left,
            )
        ) {
            return;
        }

        // * 4. Apply: positions relative to the content box (padding added),
        //   container height incl. vertical padding (padding-box origin).
        cards.forEach((card, i) => {
            const pos = layout.positions[i];
            if (!pos) return;
            card.style.left = padLeft + pos.left + "px";
            card.style.top = padTop + pos.top + "px";
        });
        node.style.height = padTop + layout.totalHeight + padBottom + "px";
        lastLayout = layout;
    };

    let relayoutRafPending = false;
    const requestRelayout = (): void => {
        // * Coalesce observer callbacks into ONE rAF pass (a pending flag makes the
        //   dedupe real — multiple observer callbacks in the same frame share one relayout).
        if (relayoutRafPending) return;
        relayoutRafPending = true;
        requestAnimationFrame(() => {
            relayoutRafPending = false;
            relayout();
        });
    };

    const resizeObserver = new ResizeObserver(requestRelayout);
    resizeObserver.observe(node);

    // * childList mutation = tab switch → re-measure + observe new cards.
    const cardListObserver = new MutationObserver(() => {
        observeCards();
        requestRelayout();
    });
    cardListObserver.observe(node, { childList: true });

    // * Observe cards separately: heights can change without childList
    //   mutating on the container (i18n switch changes text length).
    let cardObserver: ResizeObserver | null = null;
    const observeCards = (): void => {
        cardObserver?.disconnect();
        cardObserver = new ResizeObserver(requestRelayout);
        for (const card of getCards(node)) cardObserver.observe(card);
    };
    observeCards();

    // * Initial layout after mount (cards are in the DOM, heights measurable).
    relayout();

    return {
        destroy(): void {
            resizeObserver.disconnect();
            cardListObserver.disconnect();
            cardObserver?.disconnect();
            // * Reset inline styles — panel close/rebuild must not keep any
            //   leftover masonry positions.
            node.style.position = "";
            node.style.height = "";
            for (const card of getCards(node)) {
                card.style.position = "";
                card.style.width = "";
                card.style.left = "";
                card.style.top = "";
            }
        },
    };
}
