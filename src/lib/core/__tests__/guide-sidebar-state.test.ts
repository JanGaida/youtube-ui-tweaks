// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { guideSidebarFSM } from "../guide-sidebar-state";

/**
 * Tests for the GuideSidebarStateMachine (Phase 8 refactor).
 *
 * jsdom env — the FSM queries the DOM for ytd-masthead + tp-yt-app-drawer#guide.
 * Phase 8: click interceptor REMOVED. Tests verify:
 *   - enter() state-transitions (default/hide-forced/hide-override-closed)
 *   - hide-forced: stripAttr (masthead) + stripDrawerAttrs (drawer opened/persistent)
 *   - hide-override: read-only attr-observer state-sync (attr set→opened, attr removed→closed)
 *   - exit() stops observer
 *   - re-enter (mode switch): observer stopped, no stale state-sync
 */

function setMasthead(withAttr = false): HTMLElement {
    document.body.innerHTML = "";
    const masthead = document.createElement("ytd-masthead");
    if (withAttr) masthead.setAttribute("guide-persistent-and-visible", "");
    document.body.appendChild(masthead);
    return masthead;
}

function setMastheadWithDrawer(withAttr = false, drawerOpened = true): HTMLElement {
    document.body.innerHTML = "";
    const masthead = document.createElement("ytd-masthead");
    if (withAttr) masthead.setAttribute("guide-persistent-and-visible", "");
    document.body.appendChild(masthead);
    const drawer = document.createElement("tp-yt-app-drawer");
    drawer.id = "guide";
    if (drawerOpened) {
        drawer.setAttribute("opened", "");
        drawer.setAttribute("persistent", "");
    }
    drawer.setAttribute("position", "left");
    document.body.appendChild(drawer);
    return masthead;
}

function getMasthead(): HTMLElement | null {
    return document.querySelector("ytd-masthead");
}

function getDrawer(): HTMLElement | null {
    return document.querySelector("tp-yt-app-drawer#guide");
}

describe("GuideSidebarStateMachine (Phase 8)", () => {
    afterEach(() => {
        guideSidebarFSM.exit();
    });

    describe("enter()", () => {
        it("default → state=default, no attr change", () => {
            setMasthead(true);
            guideSidebarFSM.enter("default");
            expect(guideSidebarFSM.currentState).toBe("default");
            expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(true);
        });

        it("hide-forced → state=hide-forced, strips masthead attr + drawer attrs", () => {
            setMastheadWithDrawer(true, true);
            guideSidebarFSM.enter("hide-forced");
            expect(guideSidebarFSM.currentState).toBe("hide-forced");
            expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(false);
            expect(getDrawer()?.hasAttribute("opened")).toBe(false);
            expect(getDrawer()?.hasAttribute("persistent")).toBe(false);
        });

        it("hide-override → state=hide-override-closed, strips attr, starts observer", () => {
            setMasthead(true);
            guideSidebarFSM.enter("hide-override");
            expect(guideSidebarFSM.currentState).toBe("hide-override-closed");
            expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(false);
        });

        it("hide-override without masthead in DOM → state still set, no crash", () => {
            document.body.innerHTML = "";
            guideSidebarFSM.enter("hide-override");
            expect(guideSidebarFSM.currentState).toBe("hide-override-closed");
        });
    });

    describe("attr-observer state-sync (hide-override)", () => {
        it("YT sets attr in hide-override-closed → FSM syncs to opened (read-only, no re-strip)", () => {
            setMasthead(false);
            guideSidebarFSM.enter("hide-override");
            expect(guideSidebarFSM.currentState).toBe("hide-override-closed");

            // * Simulate YT's native Hamburger-toggle setting the attr.
            getMasthead()?.setAttribute("guide-persistent-and-visible", "");

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // * State syncs to opened — AND the attr STAYS (read-only, no re-strip).
                    expect(guideSidebarFSM.currentState).toBe("hide-override-opened");
                    expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(true);
                    resolve();
                }, 50);
            });
        });

        it("YT removes attr in hide-override-opened → FSM syncs to closed (read-only)", () => {
            setMasthead(false);
            guideSidebarFSM.enter("hide-override");
            // * Move to opened state.
            getMasthead()?.setAttribute("guide-persistent-and-visible", "");
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(guideSidebarFSM.currentState).toBe("hide-override-opened");
                    // * Simulate YT's native toggle removing the attr.
                    getMasthead()?.removeAttribute("guide-persistent-and-visible");
                    setTimeout(() => {
                        expect(guideSidebarFSM.currentState).toBe("hide-override-closed");
                        resolve();
                    }, 50);
                }, 50);
            });
        });

        it("attr observer does NOT re-strip in hide-override-closed (Phase 8: native toggle wins)", () => {
            setMasthead(false);
            guideSidebarFSM.enter("hide-override");
            expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(false);

            getMasthead()?.setAttribute("guide-persistent-and-visible", "");

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // * Crucial Phase 8 difference: attr STAYS (no re-strip), only state synced.
                    expect(getMasthead()?.hasAttribute("guide-persistent-and-visible")).toBe(true);
                    resolve();
                }, 50);
            });
        });
    });

    describe("exit()", () => {
        it("stops observer — attr change after exit does not sync state", () => {
            setMasthead(false);
            guideSidebarFSM.enter("hide-override");
            guideSidebarFSM.exit();

            getMasthead()?.setAttribute("guide-persistent-and-visible", "");

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(guideSidebarFSM.currentState).toBe("inactive");
                    resolve();
                }, 50);
            });
        });
    });

    describe("re-enter (mode switch)", () => {
        it("hide-override → default → observer stopped (no state-sync)", () => {
            setMasthead(false);
            guideSidebarFSM.enter("hide-override");
            expect(guideSidebarFSM.currentState).toBe("hide-override-closed");

            guideSidebarFSM.enter("default");
            expect(guideSidebarFSM.currentState).toBe("default");

            // * Attr change should NOT sync state (observer stopped).
            getMasthead()?.setAttribute("guide-persistent-and-visible", "");
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(guideSidebarFSM.currentState).toBe("default");
                    resolve();
                }, 50);
            });
        });

        it("hide-override → hide-forced → observer stopped, drawer attrs stripped", () => {
            setMastheadWithDrawer(false, true);
            guideSidebarFSM.enter("hide-override");
            guideSidebarFSM.enter("hide-forced");
            expect(guideSidebarFSM.currentState).toBe("hide-forced");
            expect(getDrawer()?.hasAttribute("opened")).toBe(false);
            expect(getDrawer()?.hasAttribute("persistent")).toBe(false);

            // * Attr change should NOT sync state (observer stopped in hide-forced).
            getMasthead()?.setAttribute("guide-persistent-and-visible", "");
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(guideSidebarFSM.currentState).toBe("hide-forced");
                    resolve();
                }, 50);
            });
        });
    });
});
