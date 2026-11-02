import { describe, it, expect } from "vitest";

import { decodeText } from "../encoding";

describe("decodeText", () => {
    it("round-trips UTF-8 content through base64", () => {
        const source = "Umüt → arrows → \nbroken? NEIN\nsecond line";
        const encoded = Buffer.from(source, "utf-8").toString("base64");
        expect(decodeText(encoded)).toBe(source);
    });
});
