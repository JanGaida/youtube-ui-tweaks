// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { STYLE_ID, injectCSSString } from "../css";

/**
 * Tests for the shared CSS injector — boot (`applyCSS`) and runtime (observer) both use it,
 * so mount/update semantics and idempotency are covered here.
 */
describe("injectCSSString", () => {
    beforeEach(() => {
        document.getElementById(STYLE_ID)?.remove();
        document.getElementById("custom-style")?.remove();
    });

    it("mounts a single style element", () => {
        injectCSSString("a{color:red}");

        const styles = document.querySelectorAll(`style#${STYLE_ID}`);
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe("a{color:red}");
    });

    it("updates the existing style instead of adding a duplicate", () => {
        injectCSSString("a{color:red}");
        injectCSSString("b{color:blue}");

        const styles = document.querySelectorAll(`style#${STYLE_ID}`);
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe("b{color:blue}");
    });

    it("supports a custom style id", () => {
        injectCSSString("c{color:green}", "custom-style");

        const styles = document.querySelectorAll("style#custom-style");
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe("c{color:green}");
    });
});
