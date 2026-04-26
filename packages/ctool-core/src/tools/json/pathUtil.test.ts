import { describe, expect, it } from "vitest";
import { findJsonNodeAtOffset, formatJsonNodeValue, formatJsonPath, getJmesPathSuggestions } from "./pathUtil";

const sample = `{
  "user": {
    "name": "Ada",
    "roles": [
      {"id": 1, "label": "admin"}
    ],
    "odd-key": true
  }
}`;

describe("json/pathUtil", () => {
    it("finds a node from a property key", () => {
        const offset = sample.indexOf("\"name\"") + 2;
        const node = findJsonNodeAtOffset(sample, offset);

        expect(node?.value).toBe("Ada");
        expect(formatJsonPath(node?.path || [])).toBe("$.user.name");
        expect(formatJsonNodeValue(node?.value)).toBe("Ada");
    });

    it("formats bracket notation for non-identifier keys", () => {
        const offset = sample.indexOf("\"odd-key\"") + 2;
        const node = findJsonNodeAtOffset(sample, offset);

        expect(formatJsonPath(node?.path || [])).toBe("$.user[\"odd-key\"]");
    });

    it("suggests fields and functions for JMESPath", () => {
        const json = JSON.parse(sample);
        const suggestions = getJmesPathSuggestions(json, "");

        expect(suggestions.map(item => item.insertText)).toContain("user.name");
        expect(suggestions.map(item => item.insertText)).toContain("user.roles[]");
        expect(suggestions.map(item => item.label)).toContain("length()");
    });

    it("suggests keys from evaluated member expressions", () => {
        const json = JSON.parse(sample);
        const suggestions = getJmesPathSuggestions(json, "user.roles[0].");

        expect(suggestions.map(item => item.insertText)).toEqual(["id", "label"]);
    });
});
