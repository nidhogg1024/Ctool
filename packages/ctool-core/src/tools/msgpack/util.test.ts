import { describe, expect, it } from "vitest";
import { encode } from "@msgpack/msgpack";
import Serialize from "@/helper/serialize";
import Text from "@/helper/text";
import { decodeMsgpack, encodeMsgpack, normalizeDecodedValue } from "./util";

describe("msgpack/util", () => {
    it("支持对象往返，并保留 bigint", () => {
        const input = Serialize.formObject({
            id: 1n,
            name: "redis-cache",
            enabled: true,
            list: [1, "two", false],
        });

        const encoded = encodeMsgpack(input);
        expect(encoded.isError()).toBe(false);
        expect(encoded.isEmpty()).toBe(false);

        const decoded = decodeMsgpack(encoded);
        expect(decoded.isError()).toBe(false);
        expect(decoded.content()).toEqual({
            id: 1n,
            name: "redis-cache",
            enabled: true,
            list: [1, "two", false],
        });
    });

    it("解码标量时自动包装为 value", () => {
        const encoded = Text.fromUint8Array(encode("ok"));
        const decoded = decodeMsgpack(encoded);

        expect(decoded.isError()).toBe(false);
        expect(decoded.content()).toEqual({
            value: "ok",
        });
    });

    it("将二进制字段归一化为 hex/base64", () => {
        const normalized = normalizeDecodedValue({
            payload: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
        });

        expect(normalized).toEqual({
            payload: {
                $type: "binary",
                hex: "deadbeef",
                base64: "3q2+7w==",
            },
        });
    });
});
