import { describe, expect, it } from "vitest";
import TextUtil from "./util";

describe("text/util zhTran", () => {
    it("keeps 退 when converting traditional text to simplified", () => {
        expect(new TextUtil("退").zhTran({ type: "traditional" })).toBe("退");
        expect(new TextUtil("退出").zhTran({ type: "traditional" })).toBe("退出");
    });

    it("does not rewrite the simplified character 煺", () => {
        expect(new TextUtil("煺").zhTran({ type: "traditional" })).toBe("煺");
    });
});
