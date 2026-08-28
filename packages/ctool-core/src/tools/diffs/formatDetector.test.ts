import { describe, expect, it } from "vitest";
import {
    detectableFormats,
    detectDiffFormat,
    detectTextFormat,
    isWellFormedXml,
    MAX_DETECTION_LENGTH,
    resemblesTextFormat,
    resolveDetectedLanguage,
} from "./formatDetector";
import type { DetectedLanguage } from "./formatDetector";

const fencedMarkdownCases = [
    ["JavaScript", "js", 'const value={name:"Ctool",enabled:true}'],
    ["JSON", "json", '{"name":"Ctool","features":["diff","format"]}'],
    ["TypeScript", "ts", "interface Tool{id:number;name:string}"],
    ["Markdown", "markdown", "# Guide\n\n- Compare source\n- Keep whitespace"],
    ["CSS", "css", ".button{color:#18a058;display:inline-flex}"],
    ["Less", "less", "@accent:#18a058;.button{color:@accent}"],
    ["SCSS", "scss", "$accent:#18a058;.button{color:$accent}"],
    ["YAML", "yaml", "name: Ctool\nfeatures: [diff,format]"],
    ["HTML", "html", "<main><strong>Ctool</strong></main>"],
    ["XML", "xml", '<catalog><book id="1" /></catalog>'],
    ["PHP", "php", '<?php function greet(){return "Ctool";}'],
    ["Java", "java", 'public class Main{public static void main(String[] args){System.out.println("Ctool");}}'],
    ["SQL", "sql", "SELECT id,name FROM tools WHERE enabled=true;"],
    ["Vue", "vue", '<template><main>{{title}}</main></template><script setup>const title="Ctool"</script>'],
    ["GraphQL", "graphql", "query GetTool($id:ID!){tool(id:$id){id name}}"],
] as const;

describe("detectTextFormat", () => {
    it.each<[DetectedLanguage, string]>([
        ["JSON", `{"name":"Ctool","features":["diff","format"]}`],
        ["Vue", `<template><main>{{ title }}</main></template>
<script setup lang="ts">const title = "Ctool"</script>`],
        ["PHP", `<?php
function greet(string $name): string {
    return "Hello " . $name;
}`],
        ["HTML", `<!doctype html>
<html><head><title>Ctool</title></head><body><main>Diff</main></body></html>`],
        ["XML", `<?xml version="1.0"?>
<catalog><book id="1"><title>Ctool</title></book></catalog>`],
        ["GraphQL", `query GetTool($id: ID!) {
    tool(id: $id) { id name }
}`],
        ["SQL", `SELECT id, name
FROM tools
WHERE enabled = true;`],
        ["TypeScript", `interface Tool {
    id: number;
    name: string;
}`],
        ["Java", `public class Main {
    public static void main(String[] args) {
        System.out.println("Ctool");
    }
}`],
        ["JavaScript", `export function compare(left, right) {
    return left === right;
}`],
        ["SCSS", `$accent: #18a058;
.button {
    color: $accent;
}`],
        ["Less", `@accent: #18a058;
.button {
    color: @accent;
}`],
        ["CSS", `.button {
    color: #18a058;
    display: inline-flex;
}`],
        ["Markdown", `# Text comparison

- Keep the original whitespace
- Detect the language
- Format only on demand`],
        ["YAML", `name: Ctool
features:
  - diff
  - format`],
        ["XML", "<root>value</root>"],
        ["SQL", "SELECT * FROM users;"],
        ["JavaScript", "const x = 1;"],
    ])("detects %s only from strong structural evidence", (language, input) => {
        expect(detectTextFormat(input)).toMatchObject({
            language,
            confidence: "high",
            empty: false,
        });
    });

    it("keeps the detector list aligned with all existing formatter languages", () => {
        expect(new Set(detectableFormats)).toEqual(new Set([
            "JavaScript",
            "JSON",
            "TypeScript",
            "Markdown",
            "CSS",
            "Less",
            "SCSS",
            "YAML",
            "HTML",
            "XML",
            "PHP",
            "Java",
            "SQL",
            "Vue",
            "GraphQL",
        ]));
    });

    it.each([
        ["JSON string primitive", `"hello"`],
        ["JSON number primitive", "42"],
        ["single YAML-like line", "status: ready"],
        ["SQL word in prose", "Please select an item from the list."],
        ["JavaScript-like prose", "Use const when a value does not change."],
        ["single Markdown-like heading", "# Release notes"],
        ["list that could be Markdown or YAML", "- first\n- second\n- third"],
        ["anonymous brace syntax", "{ user { id } }"],
        ["TypeScript/GraphQL enum ambiguity", "enum Status {\n    ACTIVE\n}"],
        ["natural language starting with a SQL verb", "Select an item from the list."],
        ["malformed JSON", `{"name":"Ctool",}`],
        ["plain text", "left side and right side should preserve whitespace"],
        ["Java interface shared syntax", "public interface Tool { void run(); }"],
        ["C# class shared syntax", "public class Program { public static void Main(string[] args) {} }"],
        ["XML with an unescaped ampersand", "<root><child>A & B</child></root>"],
        ["XML attribute without a value", "<root attr><child /></root>"],
        ["XML with mismatched tags", "<root><child></root>"],
    ])("falls back to Text for ambiguous input: %s", (_name, input) => {
        expect(detectTextFormat(input)).toMatchObject({
            language: "Text",
            confidence: "none",
        });
    });

    it("distinguishes an HTML fragment from generic XML", () => {
        expect(detectTextFormat("<div><span>Hello</span></div>").language).toBe("HTML");
        expect(detectTextFormat("<catalog><book /></catalog>").language).toBe("XML");
        expect(detectTextFormat("<catalog><book /></catalog> trailing").language).toBe("Text");
    });

    it("keeps Markdown as Markdown when it contains an embedded HTML fragment", () => {
        expect(detectTextFormat("# Guide\n\n- Keep source\n\n<div>sample</div>").language).toBe("Markdown");
    });

    it.each(fencedMarkdownCases)(
        "keeps %s code scoped inside a Markdown fence",
        (_language, fenceLanguage, code) => {
            expect(detectTextFormat(`\`\`\`${fenceLanguage}\n${code}\n\`\`\``)).toMatchObject({
                language: "Markdown",
                confidence: "high",
                reason: "markdown-structure",
            });
        },
    );

    it.each([
        ["an unlabeled fence", `\`\`\`\nconst value={name:"Ctool"}\n\`\`\``],
        ["a tilde fence", "~~~php\n<?php function greet(){return 'Ctool';}\n~~~"],
        ["multiple fences", `# Guide

\`\`\`php
<?php function before(){return "Ctool";}
\`\`\`

\`\`\`js
const after={name:"Ctool"}
\`\`\``],
    ])("recognizes Markdown from %s", (_name, input) => {
        expect(detectTextFormat(input)).toMatchObject({
            language: "Markdown",
            confidence: "high",
        });
    });

    it.each([
        ["JavaScript", "const outside = 1;", "js", "const inside = 2;"],
        ["TypeScript", "interface Outside { id: number }", "ts", "interface Inside { id: number }"],
        ["CSS", ".outside { color: red; }", "css", ".inside { color: blue; }"],
    ])("does not let %s-looking text outside a fence steal a Markdown document", (
        _language,
        outsideSource,
        fenceLanguage,
        insideSource,
    ) => {
        const input = [
            "# Guide",
            "",
            "- Compare the source",
            "",
            outsideSource,
            "",
            `\`\`\`${fenceLanguage}`,
            insideSource,
            "```",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("treats a closed top-level fence as Markdown without requiring other Markdown markers", () => {
        const input = [
            "A short guide",
            "const outside = 1;",
            "```js",
            "const inside = 2;",
            "```",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("does not mistake comment markers inside Markdown inline code for a source host", () => {
        const input = [
            "# JavaScript comment markers",
            "",
            "- These strings are documentation examples",
            "",
            "`export const opening = \"/*\";`",
            "",
            "```js",
            "const inside = 2;",
            "```",
            "",
            "`export const closing = \"*/\";`",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("keeps strong Markdown evidence when its unmatched fence appears inside comment markers", () => {
        const input = [
            "# Guide",
            "",
            "- Keep Markdown ownership",
            "",
            "export const outside = 1;",
            "/*",
            "```js",
            "const nested = 2;",
            "*/",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("keeps a Markdown heading when its supporting list and fence resemble a block comment", () => {
        const input = [
            "# Guide",
            "",
            "const outside = 1;",
            "/*",
            "- This is still a Markdown list",
            "```js",
            "const nested = 2;",
            "```",
            "*/",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("preserves first-line indentation when deciding whether a fence is top-level", () => {
        const input = [
            "    ```js",
            "    const value = 1;",
            "    ```",
        ].join("\n");
        const direct = detectTextFormat(input);
        const afterBlankLine = detectTextFormat(`\n${input}`);

        expect(direct.language).not.toBe("Markdown");
        expect(afterBlankLine.language).toBe(direct.language);
    });

    it.each<[DetectedLanguage, string]>([
        ["JavaScript", [
            "export const empty = \"\";",
            "export const value = 1;",
            "/*",
            "```js",
            "const nested = 2;",
            "```",
            "*/",
        ].join("\n")],
        ["TypeScript", [
            "export interface Tool { id: number }",
            "/*",
            "```ts",
            "interface Example { name: string }",
            "```",
            "*/",
        ].join("\n")],
        ["Java", [
            "public class Main {",
            "    public static void main(String[] args) {",
            "        String guide = \"\"\"",
            ["escaped: ", String.fromCharCode(92), '"""'].join(""),
            "```java",
            "class Example {}",
            "```",
            "\"\"\";",
            "    }",
            "}",
        ].join("\n")],
        ["PHP", [
            "<?php",
            "$guide = <<<'MARKDOWN'",
            "```php",
            "echo 'example';",
            "```",
            "MARKDOWN;",
        ].join("\n")],
        ["CSS", [
            ".button { color: red; }",
            "/*",
            "```css",
            ".example { color: blue; }",
            "```",
            "*/",
        ].join("\n")],
        ["SCSS", [
            "$accent: red;",
            ".button { color: $accent; }",
            "/*",
            "```scss",
            "$nested: blue;",
            "```",
            "*/",
        ].join("\n")],
        ["Less", [
            "@accent: red;",
            ".button { color: @accent; }",
            "// @mixin fake {}",
            "/*",
            "```less",
            "@nested: blue;",
            "```",
            "*/",
        ].join("\n")],
        ["SQL", [
            "/*",
            "```sql",
            "SELECT * FROM examples;",
            "```",
            "*/",
            "SELECT * FROM tools;",
        ].join("\n")],
        ["HTML", [
            "<html><body><!--",
            "```html",
            "<main>Example</main>",
            "```",
            "--><main>Ctool</main></body></html>",
        ].join("\n")],
        ["XML", [
            "<catalog><!--",
            "```xml",
            "<book />",
            "```",
            "--><book id=\"1\" /></catalog>",
        ].join("\n")],
        ["Vue", [
            "<template><main>{{ title }}</main></template>",
            "<script setup>const title = 'Ctool'</script>",
            "<!--",
            "```vue",
            "<template><aside>Example</aside></template>",
            "```",
            "-->",
        ].join("\n")],
    ])("keeps %s source when it contains fenced Markdown text", (language, input) => {
        expect(detectTextFormat(input).language).toBe(language);
    });

    it.each([
        ["JavaScript", "js", "const nested = 2;"],
        ["HTML", "html", "<main>Example</main>"],
    ])("keeps CSS when its comment contains fenced %s", (_name, fenceLanguage, contents) => {
        const input = [
            ".button { color: red; }",
            "/*",
            `\`\`\`${fenceLanguage}`,
            contents,
            "```",
            "*/",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("CSS");
    });

    it("keeps JavaScript when an unmatched fence is only text inside a block comment", () => {
        const input = [
            "/*",
            "```js",
            "const nested = 2;",
            "*/",
            "export const value = 1;",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("JavaScript");
    });

    it.each<[DetectedLanguage, string]>([
        ["JavaScript", [
            "/*",
            "```ts",
            "interface Nested { id: number }",
            "*/",
            "export const value = 1;",
        ].join("\n")],
        ["Java", [
            "public class Main {",
            "    /*",
            "```ts",
            "interface Nested { id: number }",
            "    */",
            "    public static void main(String[] args) {}",
            "}",
        ].join("\n")],
    ])("uses %s evidence outside an unmatched fenced block comment", (language, input) => {
        expect(detectTextFormat(input).language).toBe(language);
    });

    it("ignores HTML comment markers in JavaScript strings around a real block comment", () => {
        const input = [
            "export const opening = '<!--';",
            "/*",
            "```js",
            "const nested = 2;",
            "```",
            "*/",
            "export const closing = '-->';",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("JavaScript");
    });

    it.each([
        ["a line comment", "// interface Fake { id: number }"],
        ["a quoted string", "export const docs = \"interface Fake { id: number }\";"],
    ])("does not use TypeScript-looking text in %s as JavaScript host evidence", (
        _name,
        misleadingText,
    ) => {
        const input = [
            misleadingText,
            "/*",
            "```js",
            "const nested = 2;",
            "```",
            "*/",
            "export const value = 1;",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("JavaScript");
    });

    it("requires a closed fence to remain inside the same host comment", () => {
        const input = [
            "export const value = 1;",
            "/*",
            "```js",
            "*/",
            "const nested = 2;",
            "```",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("keeps GraphQL when fenced documentation is inside a description string", () => {
        const input = [
            "\"\"\"",
            ["escaped: ", String.fromCharCode(92), '"""'].join(""),
            "```graphql",
            "query Example { example }",
            "```",
            "\"\"\"",
            "type Query {",
            "    tool: String",
            "}",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("GraphQL");
    });

    it("keeps HTML comments after a less-than character in text content", () => {
        const input = [
            "<html><body>1 < 2",
            "<!--",
            "```html",
            "<main>Example</main>",
            "```",
            "-->",
            "<main>Ctool</main></body></html>",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("HTML");
    });

    it("does not treat C-style comments as GraphQL fence containers", () => {
        const input = [
            "query Outside { tool }",
            "/*",
            "```graphql",
            "query Nested { example }",
            "```",
            "*/",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("Markdown");
    });

    it("ignores a fake PHP heredoc opener inside a line comment", () => {
        const input = [
            "<?php",
            "// <<<FAKE",
            "$guide = <<<'MARKDOWN'",
            "```php",
            "echo 'example';",
            "```",
            "MARKDOWN;",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("PHP");
    });

    it("accepts a PHP heredoc closing label followed by expression punctuation", () => {
        const input = [
            "<?php",
            "$items = [",
            "<<<'DOC'",
            "```php",
            "echo 'example';",
            "```",
            "DOC,",
            "];",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("PHP");
    });

    it("does not mistake a nowdoc content line beginning with its label for the closing marker", () => {
        const input = [
            "<?php",
            "$docs = <<<'DOC'",
            "DOC-text",
            "```php",
            "echo 'example';",
            "```",
            "DOC;",
            "$value = 1;",
        ].join("\n");

        expect(detectTextFormat(input).language).toBe("PHP");
    });

    it("does not promote an unclosed fence to high-confidence Markdown", () => {
        expect(detectTextFormat("```js\nconst value = 1;")).toMatchObject({
            language: "Text",
            confidence: "none",
        });
    });

    it("keeps a fenced snippet inside a YAML block scalar scoped to YAML", () => {
        const input = [
            "guide: |",
            "  ```js",
            "  const value = 1;",
            "  ```",
            "name: Ctool",
        ].join("\n");

        expect(detectTextFormat(input)).toMatchObject({
            language: "YAML",
            confidence: "high",
            reason: "valid-structured-yaml",
        });
    });

    it.each([
        ["a single block-scalar field", [
            "guide: |",
            "  ```js",
            "  const value = 1;",
            "  ```",
        ].join("\n")],
        ["an unmatched fence inside a block scalar", [
            "guide: |",
            "  ```js",
            "  const value = 1;",
            "name: Ctool",
            "version: 1",
        ].join("\n")],
        ["CSS-looking scalar content next to a flow mapping", [
            "style: |",
            "  ```css",
            "  .button { color: red; }",
            "  ```",
            "theme: { color: red }",
        ].join("\n")],
        ["a nested block scalar whose contents use four-space indentation", [
            "docs:",
            "  guide: |",
            "    ```php",
            "    <?php echo 'example';",
            "    ```",
            "name: Ctool",
        ].join("\n")],
        ["a top-level sequence block scalar", [
            "- |",
            "  ```js",
            "  const value = 1;",
            "  ```",
        ].join("\n")],
        ["an anchored mapping block scalar", [
            "guide: &documentation |",
            "  ```js",
            "  const value = 1;",
            "  ```",
        ].join("\n")],
    ])("keeps valid YAML with %s scoped to YAML", (_name, input) => {
        expect(detectTextFormat(input)).toMatchObject({
            language: "YAML",
            confidence: "high",
            reason: "valid-structured-yaml",
        });
    });

    it("detects a large fenced document without blocking the editor", () => {
        const line = "const value = 1;\n";
        const code = line.repeat(Math.ceil((64 * 1024) / line.length));
        const input = `\`\`\`js\n${code}\`\`\``;
        const startedAt = performance.now();

        expect(detectTextFormat(input).language).toBe("Markdown");
        expect(performance.now() - startedAt).toBeLessThan(1000);
    });

    it.each([
        ["blank fenced Markdown", `\`\`\`\n${"\n".repeat(32 * 1024)}\`\`\``],
        ["Markdown with outer structure", [
            "# Guide",
            "",
            "- Keep Markdown ownership",
            "```text",
            "\n".repeat(256 * 1024),
            "```",
            "End of guide.",
        ].join("\n")],
        ["a YAML block scalar", [
            "guide: |",
            "  ```text",
            "  value",
            "  ".repeat(128 * 1024),
            "  ```",
        ].join("\n")],
    ])("keeps large %s detection linear", (_name, input) => {
        const startedAt = performance.now();

        expect(detectTextFormat(input).language).toMatch(/^(?:Markdown|YAML)$/);
        expect(performance.now() - startedAt).toBeLessThan(1000);
    });

    it("does not rescan the document for every unmatched PHP heredoc opener", () => {
        const heredocOpeners = Array.from(
            { length: 5000 },
            (_value, index) => `<<<DOC_${index}`,
        ).join("\n");
        const input = [
            "<?php",
            "export const value = 1;",
            heredocOpeners,
            "```js",
            "const nested = 2;",
            "```",
        ].join("\n");
        const startedAt = performance.now();

        expect(detectTextFormat(input).language).toBe("Markdown");
        expect(performance.now() - startedAt).toBeLessThan(1000);
    });

    it("does not treat invalid structured YAML as YAML", () => {
        expect(detectTextFormat("first: value\nfirst: duplicate").language).toBe("Text");
    });

    it("refuses oversized input before parsing or regex detection", () => {
        expect(detectTextFormat(`{"value":"${"x".repeat(MAX_DETECTION_LENGTH)}"}`)).toMatchObject({
            language: "Text",
            confidence: "none",
            reason: "input-too-large",
        });
    });
});

describe("xml validation", () => {
    it.each([
        "<?xml version=\"1.0\"?><root attr=\"value\">A &amp; B</root>",
        "<root>value</root>",
        "<ns:root xmlns:ns=\"urn:ctool\"><ns:item /></ns:root>",
    ])("accepts well-formed XML: %s", input => {
        expect(isWellFormedXml(input)).toBe(true);
    });

    it.each([
        "<root><child>A & B</child></root>",
        "<root attr><child /></root>",
        "<root attr=value><child /></root>",
        "<root><child></root>",
        "<root attr=\"one\" attr=\"two\" />",
    ])("rejects malformed XML: %s", input => {
        expect(isWellFormedXml(input)).toBe(false);
    });
});

describe("resemblesTextFormat", () => {
    it("keeps a stable JSON language while either side is temporarily incomplete", () => {
        expect(resemblesTextFormat(`{"name":"Ctool"`, "JSON")).toBe(true);
        expect(resemblesTextFormat("", "JSON")).toBe(true);
    });

    it("drops a stale language when the content no longer resembles it", () => {
        expect(resemblesTextFormat("a plain note", "JSON")).toBe(false);
        expect(resemblesTextFormat("SELECT * FROM tools", "JavaScript")).toBe(false);
    });
});

describe("detectDiffFormat", () => {
    const jsonLeft = `{"id":1,"name":"before"}`;
    const jsonRight = `{"id":1,"name":"after"}`;
    const yamlRight = "id: 1\nname: after";

    it("uses the populated side when the other side is empty", () => {
        expect(detectDiffFormat("", jsonRight)).toMatchObject({
            language: "JSON",
            confidence: "high",
            reason: "right-side-high-confidence",
            conflict: false,
        });
    });

    it("uses a language only when both populated sides agree", () => {
        expect(detectDiffFormat(jsonLeft, jsonRight)).toMatchObject({
            language: "JSON",
            confidence: "high",
            reason: "both-sides-agree",
            conflict: false,
        });
    });

    it("reports a conflict instead of choosing either detected format", () => {
        expect(detectDiffFormat(jsonLeft, yamlRight)).toMatchObject({
            language: "Text",
            confidence: "none",
            reason: "detected-format-conflict",
            conflict: true,
            left: { language: "JSON" },
            right: { language: "YAML" },
        });
    });

    it("stays on Text when one populated side is inconclusive", () => {
        expect(detectDiffFormat(jsonLeft, "a short note")).toMatchObject({
            language: "Text",
            confidence: "none",
            reason: "one-side-inconclusive",
            conflict: false,
        });
    });

    it("distinguishes empty and undetected pairs", () => {
        expect(detectDiffFormat("", "")).toMatchObject({
            reason: "both-sides-empty",
            empty: true,
        });
        expect(detectDiffFormat("before", "after")).toMatchObject({
            reason: "both-sides-inconclusive",
            empty: false,
        });
    });

    it("compares fenced documents as Markdown regardless of their inner languages", () => {
        const left = "```php\n<?php function before(){return 'Ctool';}\n```";
        const right = `\`\`\`js\nconst after={name:"Ctool"}\n\`\`\``;

        expect(detectDiffFormat(left, right)).toMatchObject({
            language: "Markdown",
            confidence: "high",
            conflict: false,
            left: { language: "Markdown" },
            right: { language: "Markdown" },
        });
    });

    it("uses fenced Markdown when the other side is empty", () => {
        const markdown = "```java\npublic class Main{}\n```";

        expect(detectDiffFormat("", markdown)).toMatchObject({
            language: "Markdown",
            confidence: "high",
            conflict: false,
            right: { language: "Markdown" },
        });
    });

    it("still reports a conflict between fenced Markdown and bare source code", () => {
        const markdown = "```js\nconst value = 1;\n```";
        const javascript = "export const value = 1;";

        expect(detectDiffFormat(markdown, javascript)).toMatchObject({
            language: "Text",
            confidence: "none",
            conflict: true,
            left: { language: "Markdown" },
            right: { language: "JavaScript" },
        });
    });
});

describe("resolveDetectedLanguage", () => {
    it("keeps the previous language for a temporarily incomplete document", () => {
        const left = `{"id":1`;
        const right = `{"id":2}`;
        expect(resolveDetectedLanguage(detectDiffFormat(left, right), "JSON", left, right)).toBe("JSON");
    });

    it("drops the previous language for unrelated text or a format conflict", () => {
        const plainLeft = "a plain note";
        const jsonRight = `{"id":2}`;
        expect(
            resolveDetectedLanguage(
                detectDiffFormat(plainLeft, jsonRight),
                "JSON",
                plainLeft,
                jsonRight,
            ),
        ).toBe("Text");

        const yamlRight = "id: 2\nname: Ctool";
        expect(
            resolveDetectedLanguage(
                detectDiffFormat(jsonRight, yamlRight),
                "JSON",
                jsonRight,
                yamlRight,
            ),
        ).toBe("Text");
    });

    it("keeps Markdown while one side has an unfinished fence", () => {
        const left = "```js\nconst before = 1;";
        const right = "```js\nconst after = 2;\n```";

        expect(
            resolveDetectedLanguage(
                detectDiffFormat(left, right),
                "Markdown",
                left,
                right,
            ),
        ).toBe("Markdown");
    });
});
