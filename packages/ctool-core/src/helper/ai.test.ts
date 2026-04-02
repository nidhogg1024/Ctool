import { describe, expect, it } from "vitest";
import { AI_FEATURE_COUNT, AI_TOOL_COUNT, featureSupportsAi, toolSupportsAi } from "./ai";

describe("helper/ai registry", () => {
    it("包含当前全部 AI 工具统计", () => {
        expect(AI_FEATURE_COUNT).toBe(12);
        expect(AI_TOOL_COUNT).toBe(12);
    });

    it("正确判断工具级 AI 支持", () => {
        expect(toolSupportsAi("stacktrace")).toBe(true);
        expect(toolSupportsAi("configConvert")).toBe(true);
        expect(toolSupportsAi("hash")).toBe(false);
    });

    it("正确判断功能级 AI 支持", () => {
        expect(featureSupportsAi("code", "code")).toBe(true);
        expect(featureSupportsAi("code", "run")).toBe(false);
        expect(featureSupportsAi("diffs", "diffs")).toBe(true);
    });
});
