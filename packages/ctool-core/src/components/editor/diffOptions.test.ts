import {describe, expect, it} from "vitest";
import {contentSensitiveDiffOptions} from "./diffOptions";

describe("diff editor options", () => {
    it("treats leading and trailing whitespace as user-visible changes", () => {
        expect(contentSensitiveDiffOptions.ignoreTrimWhitespace).toBe(false);
    });
});
