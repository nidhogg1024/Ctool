import { describe, expect, it } from "vitest";
import TextUtil from "./util";

describe("text/util zhTran", () => {
    it("keeps 退 when converting traditional text to simplified", () => {
        expect(new TextUtil("退").zhTran({ type: "traditional" })).toBe("退");
        expect(new TextUtil("退出").zhTran({ type: "traditional" })).toBe("退出");
    });

    it("preserves Unicode and line breaks when converting traditional text to simplified", () => {
        const input = "退出、退款、退回、進退兩難、買\r\n煺𠮷😀a";
        const expected = "退出、退款、退回、进退两难、买\r\n煺𠮷😀a";

        expect(new TextUtil(input).zhTran({ type: "traditional" })).toBe(expected);
    });

    it("preserves Unicode when converting simplified text to traditional", () => {
        expect(new TextUtil("简体中文𠮷😀a\n").zhTran({ type: "simplified" }))
            .toBe("簡體中文𠮷😀a\n");
    });

    it("does not rewrite the simplified character 煺", () => {
        expect(new TextUtil("煺").zhTran({ type: "traditional" })).toBe("煺");
    });
});
