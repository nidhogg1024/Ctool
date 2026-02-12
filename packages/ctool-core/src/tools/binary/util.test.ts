import { describe, expect, it } from "vitest";
import { generate, lengthLists } from "./util";

describe("binary/util", () => {
    describe("lengthLists", () => {
        it("包含 8 ~ 4096 的 2 的幂", () => {
            expect(lengthLists).toEqual([8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]);
        });
    });

    describe("generate - 原码 (trueForm)", () => {
        it("正数 5 / 8 位", () => {
            expect(generate("5", 8, "trueForm")).toBe("00000101");
        });

        it("负数 -5 / 8 位", () => {
            expect(generate("-5", 8, "trueForm")).toBe("10000101");
        });

        it("0 / 8 位", () => {
            expect(generate("0", 8, "trueForm")).toBe("00000000");
        });

        it("正数 127 / 8 位（最大值）", () => {
            expect(generate("127", 8, "trueForm")).toBe("01111111");
        });

        it("正数 1 / 16 位", () => {
            expect(generate("1", 16, "trueForm")).toBe("0000000000000001");
        });
    });

    describe("generate - 反码 (inverse)", () => {
        it("正数反码等于原码", () => {
            expect(generate("5", 8, "inverse")).toBe("00000101");
        });

        it("负数 -5 / 8 位", () => {
            // -5 原码 10000101 -> 反码 11111010
            expect(generate("-5", 8, "inverse")).toBe("11111010");
        });

        it("负数 -1 / 8 位", () => {
            // -1 原码 10000001 -> 反码 11111110
            expect(generate("-1", 8, "inverse")).toBe("11111110");
        });
    });

    describe("generate - 补码 (complement)", () => {
        it("正数补码等于原码", () => {
            expect(generate("5", 8, "complement")).toBe("00000101");
        });

        it("负数 -5 / 8 位", () => {
            // -5 反码 11111010 + 1 = 11111011
            expect(generate("-5", 8, "complement")).toBe("11111011");
        });

        it("负数 -1 / 8 位", () => {
            // -1 反码 11111110 + 1 = 11111111
            expect(generate("-1", 8, "complement")).toBe("11111111");
        });

        it("负数 -128 / 8 位（最小值）", () => {
            // -128 补码在 8 位系统中为 100000000（9位，含溢出位）
            expect(generate("-128", 8, "complement")).toBe("100000000");
        });
    });

    describe("generate - 异常输入", () => {
        it("非数字输入抛异常", () => {
            expect(() => generate("abc", 8, "trueForm")).toThrow("input error");
        });

        it("不支持的长度抛异常", () => {
            expect(() => generate("5", 3, "trueForm")).toThrow("length error");
        });

        it("超出范围抛异常", () => {
            // 8 位有符号范围 -128 ~ 127
            expect(() => generate("128", 8, "trueForm")).toThrow();
            expect(() => generate("-129", 8, "trueForm")).toThrow();
        });
    });
});
