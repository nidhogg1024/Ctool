import { describe, expect, it } from "vitest";
import { extractJSON, extractCode, parseSSELine } from "./llm";

describe("extractJSON", () => {
    it("直接合法 JSON 对象", () => {
        const input = '{"name": "test", "value": 123}';
        expect(extractJSON(input)).toBe(input);
    });

    it("直接合法 JSON 数组", () => {
        const input = '[1, 2, 3]';
        expect(extractJSON(input)).toBe(input);
    });

    it("带前后空白的 JSON", () => {
        const input = '  \n  {"key": "value"}  \n  ';
        expect(extractJSON(input)).toBe('{"key": "value"}');
    });

    it("markdown 代码块包裹的 JSON（带 json 标记）", () => {
        const input = '```json\n{"name": "test"}\n```';
        expect(extractJSON(input)).toBe('{"name": "test"}');
    });

    it("markdown 代码块包裹的 JSON（无语言标记）", () => {
        const input = '```\n{"name": "test"}\n```';
        expect(extractJSON(input)).toBe('{"name": "test"}');
    });

    it("有废话前缀 + markdown 代码块", () => {
        const input = '好的，这是提取到的 JSON：\n\n```json\n{"users": [{"id": 1, "name": "张三"}]}\n```\n\n希望对你有帮助！';
        expect(extractJSON(input)).toBe('{"users": [{"id": 1, "name": "张三"}]}');
    });

    it("有废话前缀 + 裸 JSON（无代码块）", () => {
        const input = 'Here is the extracted JSON:\n\n{"status": "ok", "data": [1, 2, 3]}\n\nLet me know if you need anything else.';
        expect(extractJSON(input)).toBe('{"status": "ok", "data": [1, 2, 3]}');
    });

    it("纯文本（无 JSON），返回原文", () => {
        const input = "这里没有任何 JSON 数据";
        expect(extractJSON(input)).toBe(input.trim());
    });

    it("多层嵌套 JSON", () => {
        const input = '```json\n{"a": {"b": {"c": [1, 2, {"d": true}]}}}\n```';
        expect(extractJSON(input)).toBe('{"a": {"b": {"c": [1, 2, {"d": true}]}}}');
    });

    it("数组在代码块中", () => {
        const input = '```json\n[{"id": 1}, {"id": 2}]\n```';
        expect(extractJSON(input)).toBe('[{"id": 1}, {"id": 2}]');
    });

    it("代码块中有额外空行", () => {
        const input = '```json\n\n{"key": "value"}\n\n```';
        expect(extractJSON(input)).toBe('{"key": "value"}');
    });
});

describe("extractCode", () => {
    it("markdown 代码块中的正则", () => {
        const input = '```regex\n^\\d{4}-\\d{2}-\\d{2}$\n```';
        expect(extractCode(input)).toBe("^\\d{4}-\\d{2}-\\d{2}$");
    });

    it("markdown 代码块中的 SQL", () => {
        const input = '```sql\nSELECT * FROM users WHERE age > 18\n```';
        expect(extractCode(input)).toBe("SELECT * FROM users WHERE age > 18");
    });

    it("行内代码", () => {
        const input = "`0 */2 * * 1-5`";
        expect(extractCode(input)).toBe("0 */2 * * 1-5");
    });

    it("带废话前缀（中文）", () => {
        const input = "好的，以下是生成的 Cron 表达式：\n0 30 9-17 * * MON-FRI";
        expect(extractCode(input)).toBe("0 30 9-17 * * MON-FRI");
    });

    it("带废话前缀（英文）", () => {
        const input = "Here's the regex pattern:\n^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$";
        expect(extractCode(input)).toBe("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
    });

    it("纯代码（无包裹）", () => {
        const input = "SELECT COUNT(*) FROM orders";
        expect(extractCode(input)).toBe("SELECT COUNT(*) FROM orders");
    });

    it("通用代码块（无语言标记）", () => {
        const input = "```\n^\\w+@\\w+\\.\\w+$\n```";
        expect(extractCode(input)).toBe("^\\w+@\\w+\\.\\w+$");
    });
});

describe("parseSSELine", () => {
    it("openai 格式 - 正常 delta", () => {
        const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
        expect(parseSSELine(line, "openai_compatible")).toBe("Hello");
    });

    it("openai 格式 - [DONE] 标记", () => {
        expect(parseSSELine("data: [DONE]", "openai_compatible")).toBeNull();
    });

    it("openai 格式 - 空 delta（role 消息）", () => {
        const line = 'data: {"choices":[{"delta":{"role":"assistant"}}]}';
        expect(parseSSELine(line, "openai_compatible")).toBeNull();
    });

    it("openai 格式 - 空行", () => {
        expect(parseSSELine("", "openai_compatible")).toBeNull();
    });

    it("openai 格式 - SSE 注释行", () => {
        expect(parseSSELine(": keep-alive", "openai_compatible")).toBeNull();
    });

    it("ollama 格式 - 正常消息", () => {
        const line = '{"message":{"role":"assistant","content":"世界"},"done":false}';
        expect(parseSSELine(line, "ollama")).toBe("世界");
    });

    it("ollama 格式 - done 标记", () => {
        const line = '{"message":{"role":"assistant","content":""},"done":true}';
        expect(parseSSELine(line, "ollama")).toBeNull();
    });

    it("ollama 格式 - 非法 JSON", () => {
        expect(parseSSELine("not json", "ollama")).toBeNull();
    });

    it("openai 格式 - 非法 JSON", () => {
        expect(parseSSELine("data: not json", "openai_compatible")).toBeNull();
    });

    it("openai 格式 - 包含中文内容", () => {
        const line = 'data: {"choices":[{"delta":{"content":"你好世界"}}]}';
        expect(parseSSELine(line, "openai_compatible")).toBe("你好世界");
    });

    it("openai 格式 - 包含换行符的内容", () => {
        const line = 'data: {"choices":[{"delta":{"content":"line1\\nline2"}}]}';
        expect(parseSSELine(line, "openai_compatible")).toBe("line1\nline2");
    });
});
