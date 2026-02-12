import { describe, expect, it } from "vitest";
import unicode from "./util";

describe("unicode/util", () => {
    describe("encode + decode 往返一致性", () => {
        const types = [
            "unicode_point_default",
            "unicode_point_wide",
            "unicode_point_wide_brace",
            "unicode_number",
            "html_entity_10",
            "html_entity_16",
            "css_entity",
        ] as const;

        for (const type of types) {
            it(`${type}: 中文 → encode → decode 还原`, () => {
                const input = "你好世界";
                const encoded = unicode.encode(input, type);
                const decoded = unicode.decode(encoded, type);
                expect(decoded).toBe(input);
            });
        }
    });

    describe("encode", () => {
        it("unicode_point_default: ASCII 字符", () => {
            expect(unicode.encode("A", "unicode_point_default")).toBe("\\u0041");
        });

        it("unicode_point_default: 中文", () => {
            expect(unicode.encode("你", "unicode_point_default")).toBe("\\u4f60");
        });

        it("html_entity_10: 十进制实体", () => {
            expect(unicode.encode("A", "html_entity_10")).toBe("&#65;");
        });

        it("html_entity_16: 十六进制实体", () => {
            expect(unicode.encode("A", "html_entity_16")).toBe("&#x41;");
        });

        it("css_entity: CSS 格式", () => {
            expect(unicode.encode("A", "css_entity")).toBe("\\0041");
        });

        it("ignore_ascii 选项：跳过 ASCII 字符", () => {
            const result = unicode.encode("Hi你好", "unicode_point_default", true);
            // H 和 i 被保留, 你好 被编码
            expect(result).toBe("Hi\\u4f60\\u597d");
        });
    });

    describe("decode", () => {
        it("unicode_point_default: \\u4f60 → 你", () => {
            expect(unicode.decode("\\u4f60", "unicode_point_default")).toBe("你");
        });

        it("html_entity_10: &#20320; → 你", () => {
            expect(unicode.decode("&#20320;", "html_entity_10")).toBe("你");
        });

        it("html_entity_16: &#x4f60; → 你", () => {
            expect(unicode.decode("&#x4f60;", "html_entity_16")).toBe("你");
        });

        it("混合文本：只解码 unicode 部分", () => {
            expect(unicode.decode("hello\\u4f60", "unicode_point_default")).toBe("hello你");
        });
    });

    describe("repair", () => {
        it("补零到 4 位", () => {
            expect(unicode.repair("41")).toBe("0041");
        });

        it("已经 4 位不补", () => {
            expect(unicode.repair("4f60")).toBe("4f60");
        });

        it("超过 4 位不补", () => {
            expect(unicode.repair("1f600")).toBe("1f600");
        });
    });

    describe("charToUtf16", () => {
        it("单字节字符", () => {
            expect(unicode.charToUtf16("A")).toEqual(["0041"]);
        });

        it("中文字符", () => {
            expect(unicode.charToUtf16("你")).toEqual(["4f60"]);
        });
    });
});
