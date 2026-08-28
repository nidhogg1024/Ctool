import { load as loadYaml } from "js-yaml";

export const detectableFormats = [
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
] as const;

export type DetectableFormat = (typeof detectableFormats)[number];
export type DetectedLanguage = DetectableFormat | "Text";
export type DetectionConfidence = "high" | "none";

// Detection runs on the editor's main thread. Refuse oversized input before
// trimming, parsing, or running the detector regexes.
export const MAX_DETECTION_LENGTH = 1024 * 1024;

export interface TextFormatDetection {
    language: DetectedLanguage;
    confidence: DetectionConfidence;
    score: number;
    reason: string;
    empty: boolean;
}

export interface DiffFormatDetection extends TextFormatDetection {
    left: TextFormatDetection;
    right: TextFormatDetection;
    conflict: boolean;
}

interface MarkdownFenceSpan {
    closingOffset?: number;
    openingOffset: number;
}

interface MarkdownFenceAnalysis {
    fences: MarkdownFenceSpan[];
    hasOpeningFence: boolean;
    hasClosedFence: boolean;
}

interface DetectionContext {
    markdownFences: MarkdownFenceAnalysis;
}

type Detector = (text: string, context: DetectionContext) => boolean;

const highConfidence = (language: DetectableFormat, reason: string, score = 0.95): TextFormatDetection => ({
    language,
    confidence: "high",
    score,
    reason,
    empty: false,
});

const noDetection = (reason: string, empty = false): TextFormatDetection => ({
    language: "Text",
    confidence: "none",
    score: 0,
    reason,
    empty,
});

const isJson = (text: string) => {
    if (!(
        (text.startsWith("{") && text.endsWith("}"))
        || (text.startsWith("[") && text.endsWith("]"))
    )) {
        return false;
    }

    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === "object";
    } catch {
        return false;
    }
};

const isVue = (text: string) => {
    const hasTemplate = /<template(?:\s[^>]*)?>[\s\S]*<\/template\s*>/i.test(text);
    const hasScript = /<script(?:\s[^>]*)?>[\s\S]*<\/script\s*>/i.test(text);
    const hasStyle = /<style(?:\s[^>]*)?>[\s\S]*<\/style\s*>/i.test(text);
    return hasTemplate && (hasScript || hasStyle);
};

const isPhp = (text: string) => /<\?(?:php\b|=)/i.test(text);

const htmlTags = new Set([
    "a", "article", "aside", "audio", "body", "button", "canvas", "code", "details",
    "dialog", "div", "em", "fieldset", "figure", "footer", "form", "h1", "h2", "h3",
    "h4", "h5", "h6", "head", "header", "html", "iframe", "img", "input", "label",
    "li", "link", "main", "meta", "nav", "ol", "option", "p", "picture", "script",
    "section", "select", "small", "source", "span", "strong", "style", "summary", "table",
    "tbody", "td", "textarea", "tfoot", "th", "thead", "title", "tr", "ul", "video",
]);

const isHtml = (text: string) => {
    if (
        /^<!doctype\s+html\b[^>]*>\s*<html(?:\s[^>]*)?>[\s\S]*<\/html\s*>$/i.test(text)
        || /^<html(?:\s[^>]*)?>[\s\S]*<\/html\s*>$/i.test(text)
    ) {
        return true;
    }

    const element = text.match(
        /^<([a-z][\w-]*)(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?>[\s\S]*<\/\1\s*>$/i,
    );
    if (element?.[1] && htmlTags.has(element[1].toLowerCase())) {
        return true;
    }

    const voidElement = text.match(
        /^<(img|input|link|meta|source)(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?\/?>$/i,
    );
    return Boolean(voidElement);
};

interface MarkupShape {
    elementCount: number;
    hasNamespace: boolean;
    root: string;
}

const hasInvalidXmlEntity = (value: string) => {
    return value
        .replace(/&(?:amp|lt|gt|apos|quot|#\d+|#x[0-9a-f]+);/gi, "")
        .includes("&");
};

const findMarkupEnd = (source: string, start: number) => {
    let quote = "";
    for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quote !== "") {
            if (character === quote) {
                quote = "";
            }
            continue;
        }
        if (character === `"` || character === `'`) {
            quote = character;
        } else if (character === ">") {
            return index;
        }
    }
    return -1;
};

const findDoctypeEnd = (source: string, start: number) => {
    let quote = "";
    let subsetDepth = 0;
    for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quote !== "") {
            if (character === quote) {
                quote = "";
            }
            continue;
        }
        if (character === `"` || character === `'`) {
            quote = character;
        } else if (character === "[") {
            subsetDepth += 1;
        } else if (character === "]") {
            subsetDepth -= 1;
            if (subsetDepth < 0) {
                return -1;
            }
        } else if (character === ">" && subsetDepth === 0) {
            return index;
        }
    }
    return -1;
};

const parseXmlAttributes = (value: string) => {
    let rest = value;
    const names = new Set<string>();

    while (rest.trim() !== "") {
        const attribute = rest.match(
            /^\s+([A-Z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/i,
        );
        if (!attribute) {
            return null;
        }

        const name = attribute[1];
        const attributeValue = attribute[2] ?? attribute[3] ?? "";
        if (names.has(name) || hasInvalidXmlEntity(attributeValue)) {
            return null;
        }
        names.add(name);
        rest = rest.slice(attribute[0].length);
    }

    return names;
};

const splitXmlName = (value: string) => {
    const name = value.match(/^[A-Z_][\w:.-]*/i)?.[0];
    return name === undefined
        ? null
        : { name, rest: value.slice(name.length) };
};

const getBalancedMarkupShape = (text: string): MarkupShape | null => {
    const source = text.replace(/^\uFEFF/, "").trim();
    const stack: string[] = [];
    let root = "";
    let rootCount = 0;
    let elementCount = 0;
    let hasNamespace = false;
    let cursor = 0;
    let hasDoctype = false;
    let hasXmlDeclaration = false;

    while (cursor < source.length) {
        if (source.startsWith("<!--", cursor)) {
            const end = source.indexOf("-->", cursor + 4);
            if (end < 0 || source.slice(cursor + 4, end).includes("--")) {
                return null;
            }
            cursor = end + 3;
            continue;
        }

        if (source.startsWith("<![CDATA[", cursor)) {
            const end = source.indexOf("]]>", cursor + 9);
            if (stack.length === 0 || end < 0) {
                return null;
            }
            cursor = end + 3;
            continue;
        }

        if (source.startsWith("<?", cursor)) {
            const end = source.indexOf("?>", cursor + 2);
            if (end < 0) {
                return null;
            }
            const instruction = source.slice(cursor + 2, end);
            const target = splitXmlName(instruction);
            if (!target) {
                return null;
            }
            if (target.name.toLowerCase() === "xml") {
                if (cursor !== 0 || hasXmlDeclaration || parseXmlAttributes(target.rest) === null) {
                    return null;
                }
                hasXmlDeclaration = true;
            }
            cursor = end + 2;
            continue;
        }

        if (/^<!DOCTYPE\b/i.test(source.slice(cursor))) {
            const end = findDoctypeEnd(source, cursor + 2);
            if (end < 0 || rootCount > 0 || hasDoctype) {
                return null;
            }
            hasDoctype = true;
            cursor = end + 1;
            continue;
        }

        if (source[cursor] !== "<") {
            const nextTag = source.indexOf("<", cursor);
            const end = nextTag < 0 ? source.length : nextTag;
            const content = source.slice(cursor, end);
            if (
                (stack.length === 0 && content.trim() !== "")
                || content.includes("]]>")
                || hasInvalidXmlEntity(content)
            ) {
                return null;
            }
            cursor = end;
            continue;
        }

        const end = findMarkupEnd(source, cursor + 1);
        if (end < 0) {
            return null;
        }

        let token = source.slice(cursor + 1, end);
        if (token.startsWith("/")) {
            const closing = token.match(/^\/([A-Z_][\w:.-]*)\s*$/i);
            if (!closing || stack.pop() !== closing[1]) {
                return null;
            }
            cursor = end + 1;
            continue;
        }

        const selfClosing = /\/\s*$/.test(token);
        if (selfClosing) {
            token = token.replace(/\/\s*$/, "");
        }
        const opening = splitXmlName(token);
        if (!opening) {
            return null;
        }

        const name = opening.name;
        const attributes = parseXmlAttributes(opening.rest);
        if (attributes === null) {
            return null;
        }
        if (stack.length === 0) {
            rootCount += 1;
            root ||= name;
        }
        elementCount += 1;
        hasNamespace ||= name.includes(":")
            || [...attributes].some(attribute => attribute === "xmlns" || attribute.startsWith("xmlns:"));
        if (!selfClosing) {
            stack.push(name);
        }
        cursor = end + 1;
    }

    return stack.length === 0 && rootCount === 1 && elementCount > 0
        ? { elementCount, hasNamespace, root }
        : null;
};

export const isWellFormedXml = (text: string) => getBalancedMarkupShape(text) !== null;

const isXml = (text: string) => {
    const shape = getBalancedMarkupShape(text);
    if (!shape) {
        return false;
    }

    if (/^\s*\uFEFF?<\?xml\b/i.test(text)) {
        return true;
    }

    return !htmlTags.has(shape.root.toLowerCase())
        && /^[a-z_][\w.:]*$/.test(shape.root)
        && (shape.hasNamespace || shape.elementCount >= 1);
};

const getOuterBlock = (text: string) => {
    const openingBrace = text.indexOf("{");
    const closingBrace = text.lastIndexOf("}");
    if (
        openingBrace <= 0
        || closingBrace <= openingBrace
        || text.slice(closingBrace + 1).trim() !== ""
    ) {
        return null;
    }
    return {
        header: text.slice(0, openingBrace).trim(),
        body: text.slice(openingBrace + 1, closingBrace),
    };
};

const isGraphql = (text: string) => {
    const source = text.replace(/^[ \t]*#[^\n]*(?:\n|$)/gm, "").trim();
    if (/^(?:scalar\s+\w+|directive\s+@\w+)/i.test(source)) {
        return true;
    }

    const block = getOuterBlock(source);
    if (!block || block.body.trim() === "") {
        return false;
    }
    if (/^(?:query|mutation|subscription)(?:[\s(@]|$)/i.test(block.header)) {
        return true;
    }
    if (/^fragment\s+\w+\s+on\s+\w+$/i.test(block.header)) {
        return true;
    }
    if (/^schema$/i.test(block.header)) {
        return block.body.split(/\r?\n/).some(line => /^(?:query|mutation|subscription)\s*:\s*\w+$/i.test(line.trim()));
    }
    if (/^enum\s+\w+$/i.test(block.header)) {
        const values = block.body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        return values.length >= 2 && values.every(value => /^[A-Z][A-Z0-9_]*$/.test(value));
    }
    if (!/^(?:extend\s+)?(?:type|input|interface)\s+\w+/i.test(block.header) || block.body.includes(";")) {
        return false;
    }

    return block.body.split(/\r?\n/).some(line => {
        const separator = line.lastIndexOf(":");
        if (separator < 1) {
            return false;
        }
        const fieldType = line.slice(separator + 1).trim();
        return /^(?:ID|String|Int|Float|Boolean|[A-Z]\w*)[![\]]*$/.test(fieldType);
    });
};

const stripLeadingSqlComments = (text: string) => text
    .replace(/^\s*(?:(?:--|#)[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/\s*)+/g, "")
    .trim();

const isSql = (text: string) => {
    const source = stripLeadingSqlComments(text);
    const lowerSource = source.toLowerCase();
    const fromMatch = /\sfrom\s+/i.exec(source);
    const projection = fromMatch === null
        ? ""
        : source.slice(source.search(/\s/) + 1, fromMatch.index).replace(/^distinct\s+/i, "").trim();
    const table = fromMatch === null
        ? ""
        : source.slice(fromMatch.index + fromMatch[0].length).trim().split(/\s/)[0].replace(/[;,]+$/, "");
    const identifier = /^[A-Z_"`[][\w."`\]-]*$/i;
    const selectStatement = /^select\s/i.test(source)
        && fromMatch !== null
        && (projection === "*" || projection.split(",").every(column => {
            const parts = column.trim().split(/\s+as\s+/i);
            return parts.length <= 2 && parts.every(part => identifier.test(part));
        }))
        && identifier.test(table);
    const insertStatement = /^insert\s+into\b/i.test(source) && /\bvalues\s*\(/i.test(source);
    const updateStatement = /^update\s+\S+/i.test(source) && /\sset\s+/i.test(source);
    const withStatement = /^with\s+(?:recursive\s+)?[\w"]+\s+as\s*\(/i.test(source)
        && /\)\s*(?:select|insert|update|delete)\s/i.test(source);
    const mergeStatement = /^merge\s+into\b/i.test(source) && /\susing\s+/i.test(source);

    return selectStatement
        || insertStatement
        || updateStatement
        || /^delete\s+from\b/i.test(source)
        || /^(?:create|alter|drop|truncate)\s+(?:or\s+replace\s+)?(?:table|view|index|database|schema)\b/i.test(source)
        || withStatement
        || mergeStatement
        || lowerSource === "begin;"
        || lowerSource === "commit;"
        || lowerSource === "rollback;";
};

const isTypeScript = (text: string) => {
    const interfaceDeclaration = /\binterface\s+[A-Za-z_$][\w$]*/.exec(text);
    const interfaceOpeningBrace = interfaceDeclaration === null
        ? -1
        : text.indexOf("{", interfaceDeclaration.index + interfaceDeclaration[0].length);
    const interfaceClosingBrace = interfaceOpeningBrace < 0 ? -1 : text.indexOf("}", interfaceOpeningBrace + 1);
    const interfaceBody = interfaceClosingBrace < 0
        ? undefined
        : text.slice(interfaceOpeningBrace + 1, interfaceClosingBrace);
    const enumBody = text.match(/\b(?:const\s+)?enum\s+[A-Za-z_$][\w$]*\s*\{([\s\S]*?)\}/)?.[1];
    const typeImport = /\bimport\s+type\b/.test(text) && /\bfrom\s+["'][^"']+["']/.test(text);
    const typedFunction = text.split(/\r?\n/).some(line => {
        const openingParenthesis = line.indexOf("(");
        const closingParenthesis = line.lastIndexOf(")");
        if (openingParenthesis < 0 || closingParenthesis <= openingParenthesis) {
            return false;
        }
        const parameters = line.slice(openingParenthesis + 1, closingParenthesis);
        const afterParameters = line.slice(closingParenthesis + 1);
        const typedParameter = /\b[A-Za-z_$][\w$]*\??\s*:\s*(?:string|number|boolean|bigint|symbol|unknown|never|any|[A-Z][\w$]*)/.test(parameters);
        const typedReturn = /^\s*:\s*(?:void|string|number|boolean|Promise|[A-Z][\w$]*)/.test(afterParameters);
        return (typedParameter || typedReturn)
            && (line.slice(0, openingParenthesis).includes("function") || /=>|\{/.test(afterParameters));
    });
    return typeImport
        || (interfaceBody !== undefined && (
            /(?:^|[;\n])\s*(?:readonly\s+)?[A-Za-z_$][\w$]*\??\s*:\s*[^;\n]+/m.test(interfaceBody)
            || /\b[a-z_$][\w$]*\s*\([^)]*\)\s*:\s*[^;\n]+/i.test(interfaceBody)
        ))
        || /\btype\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]+>)?\s*=/.test(text)
        || /\bconst\s+enum\s+[A-Za-z_$][\w$]*\s*\{/.test(text)
        || (enumBody !== undefined && /\b[a-z_$][\w$]*\s*=\s*["']/i.test(enumBody))
        || /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*(?:string|number|boolean|bigint|symbol|unknown|never|any|void|[A-Z][\w$]*(?:<[^;=]+>)?)(?:\[\])?\s*[=;]/.test(text)
        || typedFunction;
};

const isJava = (text: string) => {
    const hasJavaType = /\b(?:public|protected|private|abstract|final|sealed|non-sealed|static\s+)*(?:class|interface|enum|record)\s+[A-Z][\w$]*/.test(text);
    return /\bpackage\s+[a-zA-Z_][\w.]*\s*;/.test(text)
        || /\bimport\s+(?:static\s+)?(?:java|javax)\.[\w.*]+\s*;/.test(text)
        || (hasJavaType && (
            /\bpublic\s+static\s+void\s+main\s*\(\s*String(?:\[\]|\.\.\.)/.test(text)
            || /\bSystem\.(?:out|err)\.\w+\s*\(/.test(text)
            || /@Override\b/.test(text)
            || /\bimplements\s+[A-Z][\w$]*(?:\s*,\s*[A-Z][\w$]*)*/.test(text)
            || /\bthrows\s+[A-Z][\w$]*(?:\s*,\s*[A-Z][\w$]*)*/.test(text)
        ));
};

const isJavaScript = (text: string) => {
    const simpleVariable = text.split(/\r?\n/).some(line => {
        const declaration = line.trim().match(/^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/);
        return declaration !== null && line.trim().slice(declaration[0].length).replace(/;$/, "").trim() !== "";
    });
    return /\bimport\s+(?:[\w*$]+|\{[^}]+\})\s+from\s+["'][^"']+["']/.test(text)
        || /\bexport\s+(?:default|const|let|var|async\s+function|function|class)\b/.test(text)
        || /\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/.test(text)
        || /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(text)
        || simpleVariable
        || /\b(?:const|let|var)\s+\{[^}]+\}\s*=\s*require\s*\(["'][^"']+["']\)/.test(text);
};

const hasStyleBlock = (text: string) => {
    const blocks: Array<{
        contentStart: number;
        hasNestedBlock: boolean;
        selector: string;
    }> = [];
    let segmentStart = 0;

    // Scan braces once. A backtracking block regex freezes the editor on
    // large non-CSS input that reaches this detector.
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === "{") {
            const parent = blocks[blocks.length - 1];
            if (parent !== undefined) {
                parent.hasNestedBlock = true;
            }

            const selectorSource = text.slice(segmentStart, index).trim();
            const selectorSeparator = Math.max(
                selectorSource.lastIndexOf(";"),
                selectorSource.lastIndexOf("\n"),
            );
            blocks.push({
                contentStart: index + 1,
                hasNestedBlock: false,
                selector: selectorSource.slice(selectorSeparator + 1).trim(),
            });
            segmentStart = index + 1;
            continue;
        }

        if (character !== "}") {
            continue;
        }

        const block = blocks.pop();
        if (block !== undefined && !block.hasNestedBlock) {
            const declarations = text.slice(block.contentStart, index);
            if (
                block.selector.length > 0
                && !/[=;]/.test(block.selector)
                && /(?:^|;)\s*(?:--)?[a-z][\w-]*\s*:[^;{}]+(?:;|$)/i.test(declarations)
            ) {
                return true;
            }
        }
        segmentStart = index + 1;
    }

    return false;
};

const isScss = (text: string) => {
    const scssFeature = /(?:^|\n)[ \t]*\$[\w-]+[ \t]*:/.test(text)
        || /@(mixin|include|extend|use|forward|function|each|for|while|if)\b/.test(text)
        || /#\{\s*\$[\w-]+\s*\}/.test(text);
    return scssFeature && (hasStyleBlock(text) || /@(mixin|function)\b[\s\S]*\{/.test(text));
};

const isLess = (text: string) => {
    const lessFeature = /(?:^|\n)[ \t]*@[\w-]+[ \t]*:/.test(text)
        || /(?:^|[;{}\s])\.[\w-]+\s*\([^)]*\)\s*(?:when\s*\([^)]*\)\s*)?\{/.test(text)
        || /(?:^|[;{}\s])\.[\w-]+\s*\([^)]*\)\s*;/.test(text);
    return lessFeature && hasStyleBlock(text);
};

const isCss = (text: string) => {
    if (!hasStyleBlock(text)) {
        return false;
    }

    return !/\b(?:const|let|var|function|class|interface|type)\b/.test(text)
        && !/<\/?[A-Z][^>]*>/i.test(text);
};

const analyzeMarkdownFences = (text: string): MarkdownFenceAnalysis => {
    if (!text.includes("```") && !text.includes("~~~")) {
        return {
            fences: [],
            hasOpeningFence: false,
            hasClosedFence: false,
        };
    }

    const lines = text.split("\n");
    const fences: MarkdownFenceSpan[] = [];
    let lineOffset = 0;
    let openingFence: {
        fenceIndex: number;
        marker: "`" | "~";
        length: number;
    } | null = null;
    let hasOpeningFence = false;
    let hasClosedFence = false;

    lines.forEach(rawLine => {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (openingFence !== null) {
            const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
            if (
                closing?.[1]?.[0] === openingFence.marker
                && closing[1].length >= openingFence.length
            ) {
                fences[openingFence.fenceIndex].closingOffset = lineOffset + line.indexOf(closing[1]);
                openingFence = null;
                hasClosedFence = true;
            }
            lineOffset += rawLine.length + 1;
            return;
        }

        const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (!opening?.[1]) {
            lineOffset += rawLine.length + 1;
            return;
        }

        const marker = opening[1][0] as "`" | "~";
        const info = line.slice(opening[0].length);
        if (marker === "`" && info.includes("`")) {
            lineOffset += rawLine.length + 1;
            return;
        }

        const openingOffset = lineOffset + line.indexOf(opening[1]);
        fences.push({ openingOffset });
        openingFence = {
            fenceIndex: fences.length - 1,
            marker,
            length: opening[1].length,
        };
        hasOpeningFence = true;
        lineOffset += rawLine.length + 1;
    });

    return {
        fences,
        hasOpeningFence,
        hasClosedFence,
    };
};

const hasMarkdownHeading = (text: string) => /^#{1,6}\s+\S.+$/m.test(text);

const hasMarkdownStructure = (text: string) => {
    const lines = text.split(/\r?\n/);
    const table = lines.some((line, index) => {
        const delimiter = lines[index + 1];
        if (!line.includes("|") || delimiter === undefined || !delimiter.includes("|")) {
            return false;
        }
        const cells = delimiter.split("|").map(cell => cell.trim()).filter(Boolean);
        return cells.length >= 2 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
    });
    const supportingMarker = /(?:^|\n)[ \t]*(?:[-*+][ \t]+\S|>[ \t]+\S|\d+\.[ \t]+\S)|!?\[[^\]]+\]\([^)]+\)|(?:^|\n)[ \t]*---+[ \t]*(?:\n|$)/.test(text);
    return table || (hasMarkdownHeading(text) && supportingMarker);
};

const isMarkdown = (text: string, context: DetectionContext) => {
    return context.markdownFences.hasClosedFence || hasMarkdownStructure(text);
};

const isYamlMappingKey = (value: string) => /^[A-Z_][\w .-]*$/i.test(value)
    || /^"[^"]+"$/.test(value)
    || /^'[^']+'$/.test(value);

const isYamlBlockScalarLine = (line: string) => {
    const normalized = line.trim();
    const isBlockScalarHeader = (value: string) => /^(?:[!&]\S+[ \t]+)*[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:[ \t]+#.*)?$/.test(value);
    if (/^-[ \t]+/.test(normalized)) {
        return isBlockScalarHeader(normalized.replace(/^-[ \t]+/, ""));
    }

    const separator = normalized.indexOf(":");
    if (separator < 1) {
        return false;
    }
    const key = normalized.slice(0, separator).trim();
    const value = normalized.slice(separator + 1).trim();
    return isYamlMappingKey(key)
        && isBlockScalarHeader(value);
};

const hasYamlBlockScalar = (text: string) => text.split(/\r?\n/).some(isYamlBlockScalarLine);

const isYaml = (text: string) => {
    const lines = text.split(/\r?\n/);
    const mappingLines = lines.filter(line => {
        const normalized = line.trim();
        const separator = normalized.indexOf(":");
        return separator > 0 && isYamlMappingKey(normalized.slice(0, separator).trim());
    }).length;
    const listLines = lines.filter(line => /^\s*-\s+\S/.test(line)).length;
    const documentMarker = lines.some(line => /^\s*---\s*(?:#.*)?$/.test(line));
    const blockScalar = lines.some(isYamlBlockScalarLine);
    const structural = mappingLines >= 2
        || (mappingLines >= 1 && listLines >= 1)
        || (documentMarker && (mappingLines >= 1 || listLines >= 1))
        || blockScalar;

    if (!structural) {
        return false;
    }

    try {
        const value = loadYaml(text);
        return value !== null && typeof value === "object";
    } catch {
        return false;
    }
};

interface EmbeddedTextRange {
    end: number;
    start: number;
}

interface LexicalScanOptions {
    bracketQuoted?: boolean;
    collectBlockComments?: boolean;
    collectPhpHeredoc?: boolean;
    collectTripleDouble?: boolean;
    doubledQuoteEscapes?: boolean;
    lineCommentPrefixes?: string[];
    quoteCharacters?: string[];
}

interface HostTextRanges {
    fenceContainers: EmbeddedTextRange[];
    ignoredEvidence: EmbeddedTextRange[];
}

const skipQuotedText = (
    text: string,
    start: number,
    quote: string,
    doubledQuoteEscapes = false,
) => {
    for (let cursor = start + 1; cursor < text.length; cursor += 1) {
        if (text[cursor] === "\\") {
            cursor += 1;
            continue;
        }
        if (text[cursor] !== quote) {
            continue;
        }
        if (doubledQuoteEscapes && text[cursor + 1] === quote) {
            cursor += 1;
            continue;
        }
        return cursor + 1;
    }
    return text.length;
};

const findUnescapedSequence = (text: string, sequence: string, start: number) => {
    let cursor = start;
    while (cursor < text.length) {
        const match = text.indexOf(sequence, cursor);
        if (match < 0) {
            return -1;
        }

        let backslashes = 0;
        for (let index = match - 1; index >= 0 && text[index] === "\\"; index -= 1) {
            backslashes += 1;
        }
        if (backslashes % 2 === 0) {
            return match;
        }
        cursor = match + sequence.length;
    }
    return -1;
};

const phpHeredocEndFollowers = new Set([";", "\t", " ", ",", "]", ")", "/", "=", "!"]);

const findPhpHeredocEnd = (text: string, bodyStart: number, label: string) => {
    let lineStart = bodyStart;
    while (lineStart < text.length) {
        const lineEnd = text.indexOf("\n", lineStart);
        const end = lineEnd < 0 ? text.length : lineEnd;
        const closing = text.slice(lineStart, end).replace(/\r$/, "").trim();
        const nextCharacter = closing[label.length];
        if (
            closing.startsWith(label)
            && (nextCharacter === undefined || phpHeredocEndFollowers.has(nextCharacter))
        ) {
            return lineEnd < 0 ? text.length : lineEnd + 1;
        }
        lineStart = lineEnd < 0 ? text.length : lineEnd + 1;
    }
    return -1;
};

const collectLexicalHostRanges = (text: string, options: LexicalScanOptions): HostTextRanges => {
    const fenceContainers: EmbeddedTextRange[] = [];
    const ignoredEvidence: EmbeddedTextRange[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const lineComment = options.lineCommentPrefixes?.find(prefix => text.startsWith(prefix, cursor));
        if (lineComment !== undefined) {
            const lineEnd = text.indexOf("\n", cursor + lineComment.length);
            const end = lineEnd < 0 ? text.length : lineEnd + 1;
            ignoredEvidence.push({ end, start: cursor });
            cursor = end;
            continue;
        }

        if (options.collectPhpHeredoc && text.startsWith("<<<", cursor)) {
            const lineEnd = text.indexOf("\n", cursor + 3);
            const openingEnd = lineEnd < 0 ? text.length : lineEnd;
            const openingLine = text.slice(cursor, openingEnd).replace(/\r$/, "");
            const opening = openingLine.match(/^<<<[ \t]*['"]?([A-Z_]\w*)['"]?[ \t]*$/i);
            if (opening?.[1]) {
                const bodyStart = lineEnd < 0 ? text.length : lineEnd + 1;
                const end = findPhpHeredocEnd(text, bodyStart, opening[1]);
                if (end < 0) {
                    ignoredEvidence.push({ end: text.length, start: cursor });
                    break;
                }
                const range = { end, start: cursor };
                fenceContainers.push(range);
                ignoredEvidence.push(range);
                cursor = end;
                continue;
            }
        }

        if (options.collectBlockComments !== false && text.startsWith("/*", cursor)) {
            const closingStart = text.indexOf("*/", cursor + 2);
            if (closingStart < 0) {
                ignoredEvidence.push({ end: text.length, start: cursor });
                break;
            }
            const end = closingStart + 2;
            const range = { end, start: cursor };
            fenceContainers.push(range);
            ignoredEvidence.push(range);
            cursor = end;
            continue;
        }

        if (options.collectTripleDouble && text.startsWith('"""', cursor)) {
            const closingStart = findUnescapedSequence(text, '"""', cursor + 3);
            if (closingStart < 0) {
                ignoredEvidence.push({ end: text.length, start: cursor });
                break;
            }
            const end = closingStart + 3;
            const range = { end, start: cursor };
            fenceContainers.push(range);
            ignoredEvidence.push(range);
            cursor = end;
            continue;
        }

        const character = text[cursor];
        if (options.quoteCharacters?.includes(character)) {
            const end = skipQuotedText(text, cursor, character, options.doubledQuoteEscapes);
            ignoredEvidence.push({ end, start: cursor });
            cursor = end;
            continue;
        }

        if (options.bracketQuoted && character === "[") {
            const closingStart = text.indexOf("]", cursor + 1);
            const end = closingStart < 0 ? text.length : closingStart + 1;
            ignoredEvidence.push({ end, start: cursor });
            cursor = end;
            continue;
        }

        cursor += 1;
    }

    return { fenceContainers, ignoredEvidence };
};

const collectHtmlCommentRanges = (text: string): HostTextRanges => {
    const ranges: EmbeddedTextRange[] = [];
    let cursor = 0;
    let inTag = false;
    let quote = "";

    while (cursor < text.length) {
        if (!inTag && text.startsWith("<!--", cursor)) {
            const closingStart = text.indexOf("-->", cursor + 4);
            if (closingStart < 0) {
                break;
            }
            const end = closingStart + 3;
            ranges.push({ end, start: cursor });
            cursor = end;
            continue;
        }

        const character = text[cursor];
        if (!inTag) {
            if (character === "<" && /[A-Z_!/?]/i.test(text[cursor + 1] ?? "")) {
                inTag = true;
            }
        } else if (quote !== "") {
            if (character === quote) {
                quote = "";
            }
        } else if (character === `"` || character === `'`) {
            quote = character;
        } else if (character === ">") {
            inTag = false;
        }
        cursor += 1;
    }

    return { fenceContainers: ranges, ignoredEvidence: ranges };
};

const mergeEmbeddedTextRanges = (...groups: EmbeddedTextRange[][]) => {
    const indexes = groups.map(() => 0);
    const merged: EmbeddedTextRange[] = [];

    while (groups.some((group, index) => indexes[index] < group.length)) {
        let nextGroup = -1;
        groups.forEach((group, index) => {
            if (
                indexes[index] < group.length
                && (nextGroup < 0
                    || group[indexes[index]].start < groups[nextGroup][indexes[nextGroup]].start)
            ) {
                nextGroup = index;
            }
        });

        const next = groups[nextGroup][indexes[nextGroup]];
        indexes[nextGroup] += 1;
        const previous = merged[merged.length - 1];
        if (previous !== undefined && next.start <= previous.end) {
            previous.end = Math.max(previous.end, next.end);
        } else {
            merged.push({ ...next });
        }
    }

    return merged;
};

const mergeHostTextRanges = (...groups: HostTextRanges[]): HostTextRanges => ({
    fenceContainers: mergeEmbeddedTextRanges(...groups.map(group => group.fenceContainers)),
    ignoredEvidence: mergeEmbeddedTextRanges(...groups.map(group => group.ignoredEvidence)),
});

const cStyleOptions: LexicalScanOptions = {
    lineCommentPrefixes: ["//"],
    quoteCharacters: [`'`, `"`, "`"],
};

const cssOptions: LexicalScanOptions = {
    quoteCharacters: [`'`, `"`],
};

const preprocessorStyleOptions: LexicalScanOptions = {
    lineCommentPrefixes: ["//"],
    quoteCharacters: [`'`, `"`],
};

const collectEmbeddedTextRanges = (
    text: string,
    language: DetectableFormat,
    cache: Map<string, HostTextRanges>,
) => {
    const cached = (key: string, collect: () => HostTextRanges) => {
        const existing = cache.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const ranges = collect();
        cache.set(key, ranges);
        return ranges;
    };

    switch (language) {
        case "JavaScript":
        case "TypeScript":
            return cached("c-style", () => collectLexicalHostRanges(text, cStyleOptions));
        case "Java":
            return cached("java", () => collectLexicalHostRanges(text, {
                collectTripleDouble: true,
                lineCommentPrefixes: ["//"],
                quoteCharacters: [`'`, `"`],
            }));
        case "CSS":
            return cached("css", () => collectLexicalHostRanges(text, cssOptions));
        case "Less":
        case "SCSS":
            return cached("preprocessor-style", () => collectLexicalHostRanges(
                text,
                preprocessorStyleOptions,
            ));
        case "PHP":
            return cached("php", () => collectLexicalHostRanges(text, {
                collectPhpHeredoc: true,
                lineCommentPrefixes: ["//", "#"],
                quoteCharacters: [`'`, `"`, "`"],
            }));
        case "SQL":
            return cached("sql", () => collectLexicalHostRanges(text, {
                bracketQuoted: true,
                doubledQuoteEscapes: true,
                lineCommentPrefixes: ["--", "#"],
                quoteCharacters: [`'`, `"`, "`"],
            }));
        case "GraphQL":
            return cached("graphql", () => collectLexicalHostRanges(text, {
                collectBlockComments: false,
                collectTripleDouble: true,
                lineCommentPrefixes: ["#"],
                quoteCharacters: [`"`],
            }));
        case "HTML":
        case "XML":
            return cached("html", () => collectHtmlCommentRanges(text));
        case "Vue":
            return cached("vue", () => mergeHostTextRanges(
                cached("html", () => collectHtmlCommentRanges(text)),
                cached("c-style", () => collectLexicalHostRanges(text, cStyleOptions)),
            ));
        default:
            return { fenceContainers: [], ignoredEvidence: [] };
    }
};

const hasEmbeddedFenceText = (fences: MarkdownFenceSpan[], ranges: EmbeddedTextRange[]) => {
    if (ranges.length === 0) {
        return false;
    }

    let rangeIndex = 0;
    return fences.every(fence => {
        while (ranges[rangeIndex]?.end <= fence.openingOffset) {
            rangeIndex += 1;
        }
        const range = ranges[rangeIndex];
        return range !== undefined
            && range.start < fence.openingOffset
            && fence.openingOffset < range.end
            && (fence.closingOffset === undefined || fence.closingOffset < range.end);
    });
};

const removeEmbeddedText = (text: string, ranges: EmbeddedTextRange[]) => {
    const parts: string[] = [];
    let cursor = 0;

    ranges.forEach(range => {
        parts.push(text.slice(cursor, range.start), "\n");
        cursor = range.end;
    });
    parts.push(text.slice(cursor));
    return parts.join("");
};

const detectors: Array<{ language: DetectableFormat; reason: string; score: number; detect: Detector }> = [
    { language: "JSON", reason: "strict-json-object-or-array", score: 1, detect: isJson },
    { language: "Vue", reason: "vue-single-file-component", score: 0.99, detect: isVue },
    { language: "PHP", reason: "php-opening-tag", score: 0.99, detect: isPhp },
    { language: "HTML", reason: "html-document-or-known-element", score: 0.97, detect: isHtml },
    { language: "XML", reason: "well-formed-xml-document", score: 0.97, detect: isXml },
    { language: "GraphQL", reason: "graphql-operation-or-schema", score: 0.96, detect: isGraphql },
    { language: "SQL", reason: "sql-statement-shape", score: 0.96, detect: isSql },
    { language: "TypeScript", reason: "typescript-only-syntax", score: 0.96, detect: isTypeScript },
    { language: "Java", reason: "java-declaration-shape", score: 0.96, detect: isJava },
    { language: "JavaScript", reason: "javascript-module-or-function-shape", score: 0.95, detect: isJavaScript },
    { language: "SCSS", reason: "scss-specific-syntax", score: 0.96, detect: isScss },
    { language: "Less", reason: "less-specific-syntax", score: 0.96, detect: isLess },
    { language: "CSS", reason: "css-rule-and-declarations", score: 0.94, detect: isCss },
    { language: "Markdown", reason: "markdown-structure", score: 0.94, detect: isMarkdown },
    { language: "YAML", reason: "valid-structured-yaml", score: 0.94, detect: isYaml },
];

// Keep the last stable language while a user is temporarily editing an
// incomplete document, but only while the content still resembles that family.
export const resemblesTextFormat = (value: string, language: DetectableFormat) => {
    if (value.length > MAX_DETECTION_LENGTH) {
        return false;
    }

    const text = value.trim();
    if (text === "") {
        return true;
    }

    switch (language) {
        case "JSON":
            return text.startsWith("{") || text.startsWith("[");
        case "Vue":
            return /^<(?:template|script|style)\b/i.test(text);
        case "PHP":
            return /^<\?(?:php\b|=)/i.test(text);
        case "HTML": {
            if (/^<!doctype\s+html\b/i.test(text)) {
                return true;
            }
            const tag = text.match(/^<([a-z][\w-]*)\b/i)?.[1]?.toLowerCase();
            return tag !== undefined && htmlTags.has(tag);
        }
        case "XML":
            return /^<(?:\?xml\b|[a-z_][\w:.-]*\b)/i.test(text);
        case "GraphQL":
            return /^(?:(?:query|mutation|subscription|fragment|schema|scalar|directive|type|input|interface|enum)\b|\{)/i.test(text);
        case "SQL":
            return /^(?:select|insert|update|delete|create|alter|drop|truncate|with|merge|begin|commit|rollback)\b/i.test(
                stripLeadingSqlComments(text),
            );
        case "TypeScript":
            return /^(?:import\s+type|interface|type|(?:const\s+)?enum|(?:export\s+)?(?:async\s+)?function|(?:export\s+)?(?:const|let|var))\b/m.test(text);
        case "Java":
            return /^(?:package|import\s+(?:static\s+)?(?:java|javax)\.|@Override|(?:public|protected|private|abstract|final|sealed|non-sealed|static)\s+(?:class|interface|enum|record))\b/m.test(text);
        case "JavaScript":
            return /^(?:import|export|(?:async\s+)?function|class|const|let|var)\b/m.test(text);
        case "SCSS":
            return /(?:^|\n)[ \t]*(?:\$[\w-]+[ \t]*:|@(mixin|include|extend|use|forward|function|each|for|while|if)\b)|\{/.test(text);
        case "Less":
            return /(?:^|\n)[ \t]*@[\w-]+[ \t]*:|(?:^|[;{}\s])\.[\w-]+\s*\([^)]*\)|\{/.test(text);
        case "CSS": {
            const openingBrace = text.indexOf("{");
            return openingBrace > 0 && (
                !text.slice(0, openingBrace).includes("\n")
                || text.slice(openingBrace + 1).includes(":")
            );
        }
        case "Markdown":
            return /^(?:#{1,6}\s|```|~~~|[-*+]\s|>\s|\d+\.\s)/m.test(text);
        case "YAML":
            return text.split(/\r?\n/).some(line => {
                const normalized = line.trim();
                return normalized === "---"
                    || normalized.startsWith("- ")
                    || (normalized.indexOf(":") > 0 && /^[A-Z_]/i.test(normalized));
            });
    }
};

export const detectTextFormat = (value: string): TextFormatDetection => {
    if (value.length > MAX_DETECTION_LENGTH) {
        return noDetection("input-too-large");
    }

    const text = value.trim();
    if (text === "") {
        return noDetection("empty", true);
    }

    const sourceText = value.trimEnd();
    const containsFenceMarker = sourceText.includes("```") || sourceText.includes("~~~");
    // A parsed YAML document owns fence-looking scalar contents regardless of
    // indentation; nested scalars can otherwise expose PHP/CSS/JS tokens.
    if (
        containsFenceMarker
        && (sourceText.includes("|") || sourceText.includes(">"))
        && hasYamlBlockScalar(sourceText)
        && isYaml(sourceText)
    ) {
        return highConfidence("YAML", "valid-structured-yaml", 0.94);
    }

    const markdownFences = analyzeMarkdownFences(sourceText);
    const context = { markdownFences };

    if (markdownFences.hasOpeningFence) {
        const firstFenceOffset = markdownFences.fences[0]?.openingOffset ?? 0;
        const beforeFirstFence = sourceText.slice(0, firstFenceOffset);
        const hasHostContainerMarker = beforeFirstFence.includes("/*")
            || beforeFirstFence.includes("<!--")
            || beforeFirstFence.includes('"""')
            || beforeFirstFence.includes("<<<");
        if (!hasHostContainerMarker) {
            return markdownFences.hasClosedFence || hasMarkdownStructure(sourceText)
                ? highConfidence("Markdown", "markdown-structure", 0.94)
                : noDetection("no-high-confidence-match");
        }

        const hostTextRangeCache = new Map<string, HostTextRanges>();
        for (const detector of detectors) {
            if (detector.language === "Markdown" || detector.language === "YAML") {
                continue;
            }

            const hostTextRanges = collectEmbeddedTextRanges(
                sourceText,
                detector.language,
                hostTextRangeCache,
            );
            if (!hasEmbeddedFenceText(
                markdownFences.fences,
                hostTextRanges.fenceContainers,
            )) {
                continue;
            }

            // Only syntax outside the verified comment/string may identify the
            // host. This prevents fenced TypeScript inside a JavaScript comment
            // from changing the surrounding document to TypeScript.
            const hostEvidence = removeEmbeddedText(
                sourceText,
                hostTextRanges.ignoredEvidence,
            ).trim();
            if (
                hasMarkdownStructure(hostEvidence)
                || (
                    markdownFences.hasClosedFence
                    && hasMarkdownHeading(hostEvidence)
                    && hasMarkdownStructure(sourceText)
                )
                || !detector.detect(hostEvidence, context)
            ) {
                continue;
            }

            return highConfidence(detector.language, detector.reason, detector.score);
        }

        // Outside a verified host string/comment/scalar, one explicitly closed
        // top-level fence is sufficient Markdown evidence. Short-circuiting
        // here also avoids running every source-language regex over its body.
        if (markdownFences.hasClosedFence || hasMarkdownStructure(sourceText)) {
            return highConfidence("Markdown", "markdown-structure", 0.94);
        }

        return noDetection("no-high-confidence-match");
    }

    for (const detector of detectors) {
        if (!detector.detect(text, context)) {
            continue;
        }

        return highConfidence(detector.language, detector.reason, detector.score);
    }

    return noDetection("no-high-confidence-match");
};

export const detectDiffFormat = (leftValue: string, rightValue: string): DiffFormatDetection => {
    const left = detectTextFormat(leftValue);
    const right = detectTextFormat(rightValue);
    const result = {
        left,
        right,
        conflict: false,
    };

    if (left.empty && right.empty) {
        return { ...noDetection("both-sides-empty", true), ...result };
    }

    if (left.empty || right.empty) {
        const populated = left.empty ? right : left;
        if (populated.confidence === "high") {
            return {
                ...populated,
                ...result,
                reason: left.empty ? "right-side-high-confidence" : "left-side-high-confidence",
            };
        }
        return { ...noDetection("populated-side-inconclusive"), ...result };
    }

    if (left.confidence === "high" && right.confidence === "high") {
        if (left.language === right.language) {
            return {
                language: left.language,
                confidence: "high",
                score: Math.min(left.score, right.score),
                reason: "both-sides-agree",
                empty: false,
                ...result,
            };
        }

        return {
            ...noDetection("detected-format-conflict"),
            ...result,
            conflict: true,
        };
    }

    if (left.confidence === "high" || right.confidence === "high") {
        return { ...noDetection("one-side-inconclusive"), ...result };
    }

    return { ...noDetection("both-sides-inconclusive"), ...result };
};

export const resolveDetectedLanguage = (
    result: DiffFormatDetection,
    previousLanguage: DetectedLanguage,
    leftValue: string,
    rightValue: string,
): DetectedLanguage => {
    if (result.confidence === "high") {
        return result.language;
    }
    if (result.empty || result.conflict || previousLanguage === "Text") {
        return "Text";
    }
    return resemblesTextFormat(leftValue, previousLanguage)
        && resemblesTextFormat(rightValue, previousLanguage)
        ? previousLanguage
        : "Text";
};
