import { describe, expect, it } from "vitest";
import { detectDiffFormat } from "../../diffs/formatDetector";
import formatter from "./index";

const beautifyCases = [
    {
        key: "javascript",
        language: "JavaScript",
        code: "export function compare(left,right){return left===right;}",
    },
    {
        key: "json",
        language: "JSON",
        code: '{"name":"Ctool","features":["diff","format"]}',
    },
    {
        key: "typescript",
        language: "TypeScript",
        code: "interface Tool{id:number;name:string;}",
    },
    {
        key: "markdown",
        language: "Markdown",
        code: "# Text comparison\n\n-   Keep the original whitespace\n-   Detect language",
    },
    {
        key: "css",
        language: "CSS",
        code: ".button{color:#18a058;display:inline-flex;}",
    },
    {
        key: "less",
        language: "Less",
        code: "@accent:#18a058;.button{color:@accent;}",
    },
    {
        key: "scss",
        language: "SCSS",
        code: "$accent:#18a058;.button{color:$accent;}",
    },
    {
        key: "yaml",
        language: "YAML",
        code: "name: Ctool\nfeatures: [diff,format]",
    },
    {
        key: "html",
        language: "HTML",
        code: "<!doctype html><html><head><title>Ctool</title></head><body><main>Diff</main></body></html>",
    },
    {
        key: "xml",
        language: "XML",
        code: '<catalog><book id="1"><title>Ctool</title></book></catalog>',
    },
    {
        key: "php",
        language: "PHP",
        code: '<?php function greet(string $name):string{return "Hello ".$name;}',
    },
    {
        key: "java",
        language: "Java",
        code: 'public class Main{public static void main(String[] args){System.out.println("Ctool");}}',
    },
    {
        key: "sql",
        language: "SQL",
        code: "SELECT id,name FROM tools WHERE enabled=true;",
    },
    {
        key: "vue",
        language: "Vue",
        code: '<template><main>{{title}}</main></template><script setup lang="ts">const title="Ctool"</script>',
    },
    {
        key: "graphql",
        language: "GraphQL",
        code: "query GetTool($id:ID!){tool(id:$id){id name}}",
    },
] as const;

const supportedMarkdownFenceCases = [
    {
        language: "js",
        code: 'const data={name:"Ctool",enabled:true}',
        formatted: 'const data = { name: "Ctool", enabled: true };',
    },
    {
        language: "json",
        code: '{"name":"Ctool","features":["diff","format"]}',
        formatted: '{ "name": "Ctool", "features": ["diff", "format"] }',
    },
    {
        language: "ts",
        code: "interface Tool{id:number;name:string}",
        formatted: `interface Tool {
    id: number;
    name: string;
}`,
    },
    {
        language: "css",
        code: ".button{color:#18a058;display:inline-flex}",
        formatted: `.button {
    color: #18a058;
    display: inline-flex;
}`,
    },
    {
        language: "less",
        code: "@accent:#18a058;.button{color:@accent}",
        formatted: `@accent: #18a058;
.button {
    color: @accent;
}`,
    },
    {
        language: "scss",
        code: "$accent:#18a058;.button{color:$accent}",
        formatted: `$accent: #18a058;
.button {
    color: $accent;
}`,
    },
    {
        language: "html",
        code: '<div id="app" class="root"><section><h1>Ctool</h1><p>Diff</p></section></div>',
        formatted: `<div id="app" class="root">
    <section>
        <h1>Ctool</h1>
        <p>Diff</p>
    </section>
</div>`,
    },
    {
        language: "vue",
        code: '<template><main>{{title}}</main></template><script setup lang="ts">const title:string="Ctool"</script>',
        formatted: `<template>
    <main>{{ title }}</main>
</template>
<script setup lang="ts">
const title: string = "Ctool";
</script>`,
    },
    {
        language: "yaml",
        code: "name: Ctool\nfeatures: [diff,format]",
        formatted: "name: Ctool\nfeatures: [diff, format]",
    },
    {
        language: "graphql",
        code: "query GetTool($id:ID!){tool(id:$id){id name}}",
        formatted: `query GetTool($id: ID!) {
    tool(id: $id) {
        id
        name
    }
}`,
    },
    {
        language: "markdown",
        code: "#   Heading\n\n>quote\n\n|a|b|\n|-|-|\n|1|2|",
        formatted: `# Heading

> quote

| a   | b   |
| --- | --- |
| 1   | 2   |`,
    },
    {
        language: "php",
        code: '<?php function greet(string $name):string{return "Hello ".$name;}',
        formatted: `<?php function greet(string $name): string
{
    return "Hello " . $name;
}`,
    },
    {
        language: "java",
        code: 'public class Main{public static void main(String[] args){System.out.println("Ctool");}}',
        formatted: `public class Main {

    public static void main(String[] args) {
        System.out.println("Ctool");
    }
}
`,
    },
] as const;

describe("formatter integration", () => {
    it("formats TypeScript through the public formatter entry", async () => {
        await expect(
            formatter.simple("TypeScript", "beautify", "const value:number=1;"),
        ).resolves.toBe("const value: number = 1;\n");
    });

    it("formats embedded JavaScript and CSS in Vue", async () => {
        await expect(
            formatter.simple(
                "Vue",
                "beautify",
                '<template><main>{{title}}</main></template><script setup>const title="Ctool"</script><style>.box{color:red}</style>',
            ),
        ).resolves.toBe(`<template>
    <main>{{ title }}</main>
</template>
<script setup>
const title = "Ctool";
</script>
<style>
.box {
    color: red;
}
</style>
`);
    });

    it("formats template expressions, TypeScript, and SCSS in Vue", async () => {
        await expect(
            formatter.simple(
                "Vue",
                "beautify",
                '<template><main>{{title}}</main></template><script setup lang="ts">const title:string="Ctool"</script><style lang="scss">$accent:red;.box{color:$accent}</style>',
            ),
        ).resolves.toBe(`<template>
    <main>{{ title }}</main>
</template>
<script setup lang="ts">
const title: string = "Ctool";
</script>
<style lang="scss">
$accent: red;
.box {
    color: $accent;
}
</style>
`);
    });

    it("formats embedded JavaScript, JSON-LD, and CSS in HTML", async () => {
        await expect(
            formatter.simple(
                "HTML",
                "beautify",
                '<main><script>const data={name:"Ctool"}</script><script type="application/ld+json">{"name":"Ctool","tags":["diff","format"]}</script><style>.box{color:red}</style></main>',
            ),
        ).resolves.toBe(`<main>
    <script>
        const data = { name: "Ctool" };
    </script>
    <script type="application/ld+json">
        { "name": "Ctool", "tags": ["diff", "format"] }
    </script>
    <style>
        .box {
            color: red;
        }
    </style>
</main>
`);
    });

    it("formats embedded TypeScript in HTML", async () => {
        await expect(
            formatter.simple(
                "HTML",
                "beautify",
                '<script lang="ts">interface Tool{id:number}const tool:Tool={id:1}</script>',
            ),
        ).resolves.toBe(`<script lang="ts">
    interface Tool {
        id: number;
    }
    const tool: Tool = { id: 1 };
</script>
`);
    });

    it("formats every supported labeled code fence in Markdown", async () => {
        for (const {
            language,
            code,
            formatted,
        } of supportedMarkdownFenceCases) {
            const output = await formatter.simple(
                "Markdown",
                "beautify",
                `\`\`\`${language}\n${code}\n\`\`\``,
            );

            expect(output, `${language} fence`).toBe(
                `\`\`\`${language}\n${formatted}\n\`\`\`\n`,
            );
        }
    });

    it("preserves unlabeled, SQL, and XML code fence contents in Markdown", async () => {
        const input = [
            "```",
            'const data={name:"Ctool"}',
            "```",
            "",
            "```sql",
            "SELECT id,name FROM tools WHERE enabled=true;",
            "```",
            "",
            "```xml",
            '<catalog><book id="1"><title>Ctool</title></book></catalog>',
            "```",
            "",
        ].join("\n");

        await expect(
            formatter.simple("Markdown", "beautify", input),
        ).resolves.toBe(input);
    });

    it("detects and formats Markdown sides with different fenced languages", async () => {
        const left = `# Before

\`\`\`php
<?php function before(){return "Ctool";}
\`\`\``;
        const right = `# After

\`\`\`js
const after={name:"Ctool"}
\`\`\``;
        const detection = detectDiffFormat(left, right);

        expect(detection).toMatchObject({
            language: "Markdown",
            confidence: "high",
            conflict: false,
        });
        await expect(
            formatter.simple(detection.language, "beautify", left),
        ).resolves.toBe(`# Before

\`\`\`php
<?php function before()
{
    return "Ctool";
}
\`\`\`
`);
        await expect(
            formatter.simple(detection.language, "beautify", right),
        ).resolves.toBe(`# After

\`\`\`js
const after = { name: "Ctool" };
\`\`\`
`);
    });

    it("loads and runs every enabled beautifier sequentially", async () => {
        expect(beautifyCases.map(({ key }) => key).sort()).toEqual(
            formatter.allLanguageType,
        );

        for (const { language, code } of beautifyCases) {
            expect(formatter.isEnable(language, "beautify")).toBe(true);

            const output = await formatter.simple(language, "beautify", code);

            expect(output).toEqual(expect.any(String));
            expect(String(output).trim()).not.toBe("");
        }
    });
});
