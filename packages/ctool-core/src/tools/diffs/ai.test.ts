import { describe, expect, it } from "vitest";
import { buildDiffSummaryPrompt, isCodeLikeDiff } from "./ai";

describe("diffs/ai", () => {
    it("普通文本差异默认不走风险分析", () => {
        const input = {
            language: "Text",
            original: "用户下单后仅创建订单记录，不发送通知。",
            modified: "用户下单后创建订单记录，并异步发送短信通知与站内信。",
        };

        expect(isCodeLikeDiff(input)).toBe(false);
        expect(buildDiffSummaryPrompt(input)).toMatchObject({
            codeLike: false,
            system: expect.stringContaining("不要展开风险分析"),
        });
    });

    it("代码语言差异会补充影响和验证点", () => {
        const input = {
            language: "TypeScript",
            original: "export const sum = (a: number, b: number) => a + b;",
            modified: "export const sum = (a: number, b: number) => Number(a) + Number(b);",
        };

        expect(isCodeLikeDiff(input)).toBe(true);
        expect(buildDiffSummaryPrompt(input)).toMatchObject({
            codeLike: true,
            system: expect.stringContaining("行为影响"),
        });
    });

    it("即使语言是 Text，代码形态内容也按代码差异处理", () => {
        const input = {
            language: "Text",
            original: "function add(a, b) { return a + b; }",
            modified: "function add(a, b) { return Number(a) + Number(b); }",
        };

        expect(isCodeLikeDiff(input)).toBe(true);
    });
});
