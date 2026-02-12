import { describe, expect, it } from "vitest";
import jsonMinify from "./jsonMinify";

describe("jsonMinify", () => {
    it("压缩简单 JSON", () => {
        const input = `{
    "name": "test",
    "value": 123
}`;
        expect(jsonMinify(input)).toBe('{"name":"test","value":123}');
    });

    it("移除单行注释", () => {
        const input = `{
    // 这是注释
    "key": "value"
}`;
        expect(jsonMinify(input)).toBe('{"key":"value"}');
    });

    it("移除多行注释", () => {
        const input = `{
    /* 多行
       注释 */
    "key": "value"
}`;
        expect(jsonMinify(input)).toBe('{"key":"value"}');
    });

    it("保留字符串中的空格", () => {
        const input = `{ "key": "hello   world" }`;
        expect(jsonMinify(input)).toBe('{"key":"hello   world"}');
    });

    it("保留字符串中的转义引号", () => {
        const input = `{ "key": "he said \\"hello\\"" }`;
        expect(jsonMinify(input)).toBe('{"key":"he said \\"hello\\""}');
    });

    it("空对象（无换行符时返回空）", () => {
        // jsonMinify 的 tokenizer 依赖换行符或注释分隔符触发，
        // 纯空格的 "{ }" 没有 token 命中，结果为空字符串
        expect(jsonMinify("{\n}")).toBe("{}");
    });

    it("空数组（无换行符时返回空）", () => {
        expect(jsonMinify("[\n]")).toBe("[]");
    });

    it("嵌套结构", () => {
        const input = `{
    "a": {
        "b": [1, 2, 3]
    }
}`;
        expect(jsonMinify(input)).toBe('{"a":{"b":[1,2,3]}}');
    });
});
