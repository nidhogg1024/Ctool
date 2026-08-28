import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

const popupHtml = readFileSync(new URL("../popup.html", import.meta.url), "utf8");
const toolHtml = readFileSync(new URL("../tool.html", import.meta.url), "utf8");

const readInlineStyle = (element: "html" | "body") => {
    const style = popupHtml.match(new RegExp(`<${element}[^>]*style="([^"]+)"`))?.[1];
    expect(style).toBeDefined();

    return Object.fromEntries(
        style!
            .split(";")
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .map((declaration) => declaration.split(":", 2).map((part) => part.trim())),
    );
};

describe("browser action popup", () => {
    it.each(["html", "body"] as const)(
        "sets a synchronous fixed size on %s",
        (element) => {
            expect(readInlineStyle(element)).toMatchObject({
                width: "800px",
                height: "580px",
                margin: "0",
                padding: "0",
                overflow: "hidden",
            });
        },
    );

    it("shares the app entry without fixing the responsive tool page", () => {
        const readEntry = (html: string) =>
            html.match(/<script type="module" src="([^"]+)"/)?.[1];

        expect(readEntry(popupHtml)).toBe("/src/tool.ts");
        expect(readEntry(toolHtml)).toBe("/src/tool.ts");
        expect(toolHtml).not.toMatch(/<(?:html|body)[^>]*style=/);
    });

    it.each(["chrome", "edge"])(
        "uses the dedicated popup entry in the %s manifest",
        (browser) => {
            const manifest = JSON.parse(
                readFileSync(
                    new URL(
                        `../../ctool-adapter/${browser}/resources/manifest.json`,
                        import.meta.url,
                    ),
                    "utf8",
                ),
            );

            expect(manifest.action.default_popup).toBe("popup.html");
        },
    );

    it("keeps Firefox on its responsive popup entry", () => {
        const manifest = JSON.parse(
            readFileSync(
                new URL(
                    "../../ctool-adapter/firefox/resources/manifest.json",
                    import.meta.url,
                ),
                "utf8",
            ),
        );

        expect(manifest.action.default_popup).toBe("index.html");
    });
});
