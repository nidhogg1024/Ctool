import {describe, expect, it} from "vitest";
import {getFullPageUrl} from "./fullPageUrl";

describe("getFullPageUrl", () => {
    it.each([
        [
            "chrome-extension://extension-id/popup.html#/tool/diffs?category=text",
            "chrome-extension://extension-id/tool.html#/tool/diffs?category=text",
        ],
        [
            "moz-extension://extension-id/popup.html?source=action#/tool/json",
            "moz-extension://extension-id/tool.html?source=action#/tool/json",
        ],
    ])("opens popup routes on the responsive tool page", (currentUrl, expected) => {
        expect(getFullPageUrl(currentUrl)).toBe(expected);
    });

    it("keeps existing full-page URLs unchanged", () => {
        const currentUrl = "https://ctool.dev/tool.html#/tool/text?category=text";
        expect(getFullPageUrl(currentUrl)).toBe(currentUrl);
    });
});
