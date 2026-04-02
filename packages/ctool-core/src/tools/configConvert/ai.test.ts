import { describe, expect, it } from "vitest";
import { normalizeDetectedFormat } from "./ai";

const formats = [
    "json", "yaml", "toml", "xml", "csv", "properties",
    "html_table", "http_query_string", "php_array", "php_serialize",
] as const;

describe("configConvert/ai", () => {
    it("支持 query string 别名归一化", () => {
        expect(normalizeDetectedFormat("querystring", formats)).toBe("http_query_string");
        expect(normalizeDetectedFormat("http-query", formats)).toBe("http_query_string");
    });

    it("支持 html table 别名归一化", () => {
        expect(normalizeDetectedFormat("html table", formats)).toBe("html_table");
        expect(normalizeDetectedFormat("table", formats)).toBe("html_table");
    });

    it("不支持的格式返回 null", () => {
        expect(normalizeDetectedFormat("ini", formats)).toBeNull();
    });
});
