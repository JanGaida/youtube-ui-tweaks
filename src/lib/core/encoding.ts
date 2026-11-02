/**
 * Shared runtime decoders for text embedded at build time (ADR 0010, ADR 0011).
 *
 * Base64 is used only to keep static text out of the compiled bundle as a raw
 * literal; it is not confidentiality.
 */
export function decodeText(encoded: string): string {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
}
