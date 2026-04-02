import { describe, expect, it } from "vitest";
import Serialize from "./index";

describe("helper/serialize", () => {
    it("formText should split multiline text into array items", () => {
        const result = Serialize.formText("alpha\nbeta\n\n gamma ");
        expect(result.isError()).toBe(false);
        expect(result.content()).toEqual(["alpha", "beta", "gamma"]);
    });

    it("json fallback should support pure Chinese multiline text when converting to text", () => {
        const result = Serialize.formJson("你好\n世界");
        expect(result.isError()).toBe(false);
        expect(result.content()).toEqual(["你好", "世界"]);
        expect(result.toText()).toBe("你好,\n世界");
    });
});
