import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32 } from "./util";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("base32/util", () => {
    it.each([
        ["", ""],
        ["f", "MY======"],
        ["fo", "MZXQ===="],
        ["foo", "MZXW6==="],
        ["foob", "MZXW6YQ="],
        ["fooba", "MZXW6YTB"],
        ["foobar", "MZXW6YTBOI======"],
    ])("encodes RFC 4648 vector %#", (plain, encoded) => {
        expect(encodeBase32(encoder.encode(plain))).toBe(encoded);
    });

    it.each([
        ["", ""],
        ["MY======", "f"],
        ["MZXQ====", "fo"],
        ["MZXW6===", "foo"],
        ["MZXW6YQ=", "foob"],
        ["MZXW6YTB", "fooba"],
        ["MZXW6YTBOI======", "foobar"],
    ])("decodes RFC 4648 vector %#", (encoded, plain) => {
        expect(decoder.decode(decodeBase32(encoded))).toBe(plain);
    });

    it("accepts lowercase and whitespace", () => {
        expect(decoder.decode(decodeBase32("mzxw 6ytb\noi======"))).toBe("foobar");
    });

    it("rejects invalid characters and padding", () => {
        expect(() => decodeBase32("MZXW6===")).not.toThrow();
        expect(() => decodeBase32("MZXW6YT!")).toThrow("Invalid Base32 character");
        expect(() => decodeBase32("MZX=W6===")).toThrow("Invalid Base32 padding");
    });
});
