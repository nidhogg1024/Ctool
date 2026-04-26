const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PADDING = "=";

const DECODE_MAP = new Map<string, number>(
    ALPHABET.split("").map((char, index) => [char, index]),
);

const expectedPaddingByRemainder: Record<number, number> = {
    0: 0,
    2: 6,
    4: 4,
    5: 3,
    7: 1,
};

export const encodeBase32 = (bytes: Uint8Array): string => {
    if (bytes.length === 0) {
        return "";
    }

    let output = "";
    let value = 0;
    let bits = 0;

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            output += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += ALPHABET[(value << (5 - bits)) & 31];
    }

    while (output.length % 8 !== 0) {
        output += PADDING;
    }

    return output;
};

export const decodeBase32 = (input: string): Uint8Array => {
    const normalized = input.replace(/\s+/g, "").toUpperCase();
    if (normalized === "") {
        return new Uint8Array();
    }

    const firstPaddingIndex = normalized.indexOf(PADDING);
    if (firstPaddingIndex !== -1 && !/^=+$/.test(normalized.slice(firstPaddingIndex))) {
        throw new Error("Invalid Base32 padding");
    }

    const padding = normalized.length - normalized.replace(/=+$/, "").length;
    const valuePart = normalized.slice(0, normalized.length - padding);
    const remainder = valuePart.length % 8;
    const expectedPadding = expectedPaddingByRemainder[remainder];

    if (expectedPadding === undefined) {
        throw new Error("Invalid Base32 length");
    }
    if (padding > 0 && (normalized.length % 8 !== 0 || padding !== expectedPadding)) {
        throw new Error("Invalid Base32 padding");
    }

    let value = 0;
    let bits = 0;
    const output: number[] = [];

    for (const char of valuePart) {
        const index = DECODE_MAP.get(char);
        if (index === undefined) {
            throw new Error(`Invalid Base32 character: ${char}`);
        }

        value = (value << 5) | index;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xFF);
            bits -= 8;
        }
    }

    if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
        throw new Error("Invalid Base32 trailing bits");
    }

    return Uint8Array.from(output);
};
