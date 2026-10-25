// ─────────────────────────────────────────────────────────────────────────────
// MARK: Masthead icons — SVG via Vite ?raw import from assets/
// ─────────────────────────────────────────────────────────────────────────────
// * SVG source files: src/assets/masthead-icons/*.svg — swappable/customizable.
// * The Vite ?raw import returns the file content as a string (build time, no fetch).
// * The viewBox is extracted from the SVG (supports YT 0 0 24 24 + Material 0 -960 960 960).

import historySvgRaw from "../../assets/masthead-icons/history.svg?raw";
import subscriptionsSvgRaw from "../../assets/masthead-icons/subscriptions.svg?raw";
import playlistsSvgRaw from "../../assets/masthead-icons/playlists.svg?raw";
import watchLaterSvgRaw from "../../assets/masthead-icons/watch-later.svg?raw";
import likedVideosSvgRaw from "../../assets/masthead-icons/liked-videos.svg?raw";
import myVideosSvgRaw from "../../assets/masthead-icons/my-videos.svg?raw";
import downloadsSvgRaw from "../../assets/masthead-icons/downloads.svg?raw";
import settingsSvgRaw from "../../assets/masthead-icons/settings.svg?raw";

/** Definition of a masthead icon: SVG path data + viewBox. */
export interface IconDef {
    path: string;
    viewBox: string;
}

/**
 * Extracts the path `d` attribute and viewBox from a raw SVG string.
 *
 * @param svg - Raw SVG markup (from a Vite `?raw` import).
 * @returns The parsed icon definition.
 * @throws {Error} If no `<path d="...">` is found.
 */
function parseSvg(svg: string): IconDef {
    const pathMatch = svg.match(/<path\s+[^>]*d="([^"]+)"/);
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    if (!pathMatch) throw new Error("SVG: no <path d=...> found");
    return {
        path: pathMatch[1],
        viewBox: viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24",
    };
}

/** History icon for the masthead custom-button bar. */
export const HISTORY_ICON = parseSvg(historySvgRaw);
/** Subscriptions icon for the masthead custom-button bar. */
export const SUBSCRIPTIONS_ICON = parseSvg(subscriptionsSvgRaw);
/** Playlists icon for the masthead custom-button bar. */
export const PLAYLISTS_ICON = parseSvg(playlistsSvgRaw);
/** Watch-later icon for the masthead custom-button bar. */
export const WATCH_LATER_ICON = parseSvg(watchLaterSvgRaw);
/** Liked-videos icon for the masthead custom-button bar. */
export const LIKED_VIDEOS_ICON = parseSvg(likedVideosSvgRaw);
/** My-videos icon for the masthead custom-button bar. */
export const MY_VIDEOS_ICON = parseSvg(myVideosSvgRaw);
/** Downloads icon for the masthead custom-button bar. */
export const DOWNLOADS_ICON = parseSvg(downloadsSvgRaw);
/** Settings icon for the masthead custom-button bar (b/w silhouette from icon.svg — magic wand + stars). */
export const SETTINGS_ICON = parseSvg(settingsSvgRaw);
