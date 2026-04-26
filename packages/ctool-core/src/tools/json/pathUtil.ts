import jmespath from "jmespath";

export type JsonPathSegment = string | number;

export type JsonLocationNode = {
    type: "object" | "array" | "string" | "number" | "boolean" | "null";
    start: number;
    end: number;
    keyStart?: number;
    keyEnd?: number;
    path: JsonPathSegment[];
    value: any;
    children: JsonLocationNode[];
};

type StringToken = {
    value: string;
    start: number;
    end: number;
};

class JsonLocationParser {
    private index = 0;

    constructor(private readonly source: string) {}

    parse() {
        const value = this.parseValue([]);
        this.skipWhitespace();
        if (this.index !== this.source.length) {
            throw new Error("Unexpected JSON content");
        }
        return value;
    }

    private parseValue(path: JsonPathSegment[]): JsonLocationNode {
        this.skipWhitespace();
        const char = this.source[this.index];
        if (char === "{") {
            return this.parseObject(path);
        }
        if (char === "[") {
            return this.parseArray(path);
        }
        if (char === "\"") {
            const token = this.parseStringToken();
            return { type: "string", start: token.start, end: token.end, path, value: token.value, children: [] };
        }
        if (char === "t" || char === "f") {
            return this.parseBoolean(path);
        }
        if (char === "n") {
            return this.parseNull(path);
        }
        return this.parseNumber(path);
    }

    private parseObject(path: JsonPathSegment[]): JsonLocationNode {
        const start = this.index;
        const value: Record<string, any> = {};
        const children: JsonLocationNode[] = [];
        this.index++;
        this.skipWhitespace();
        if (this.source[this.index] === "}") {
            this.index++;
            return { type: "object", start, end: this.index, path, value, children };
        }
        while (this.index < this.source.length) {
            this.skipWhitespace();
            const key = this.parseStringToken();
            this.skipWhitespace();
            this.expect(":");
            const child = this.parseValue([...path, key.value]);
            child.keyStart = key.start;
            child.keyEnd = key.end;
            value[key.value] = child.value;
            children.push(child);
            this.skipWhitespace();
            if (this.source[this.index] === "}") {
                this.index++;
                return { type: "object", start, end: this.index, path, value, children };
            }
            this.expect(",");
        }
        throw new Error("Unclosed JSON object");
    }

    private parseArray(path: JsonPathSegment[]): JsonLocationNode {
        const start = this.index;
        const value: any[] = [];
        const children: JsonLocationNode[] = [];
        this.index++;
        this.skipWhitespace();
        if (this.source[this.index] === "]") {
            this.index++;
            return { type: "array", start, end: this.index, path, value, children };
        }
        while (this.index < this.source.length) {
            const child = this.parseValue([...path, children.length]);
            value.push(child.value);
            children.push(child);
            this.skipWhitespace();
            if (this.source[this.index] === "]") {
                this.index++;
                return { type: "array", start, end: this.index, path, value, children };
            }
            this.expect(",");
        }
        throw new Error("Unclosed JSON array");
    }

    private parseStringToken(): StringToken {
        const start = this.index;
        this.expect("\"");
        while (this.index < this.source.length) {
            const char = this.source[this.index];
            if (char === "\\") {
                this.index += 2;
                continue;
            }
            this.index++;
            if (char === "\"") {
                const end = this.index;
                return {
                    start,
                    end,
                    value: JSON.parse(this.source.slice(start, end)),
                };
            }
        }
        throw new Error("Unclosed JSON string");
    }

    private parseNumber(path: JsonPathSegment[]): JsonLocationNode {
        const start = this.index;
        const match = this.source.slice(this.index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?/i);
        if (!match) {
            throw new Error("Invalid JSON number");
        }
        this.index += match[0].length;
        return { type: "number", start, end: this.index, path, value: Number(match[0]), children: [] };
    }

    private parseBoolean(path: JsonPathSegment[]): JsonLocationNode {
        const start = this.index;
        if (this.source.startsWith("true", this.index)) {
            this.index += 4;
            return { type: "boolean", start, end: this.index, path, value: true, children: [] };
        }
        if (this.source.startsWith("false", this.index)) {
            this.index += 5;
            return { type: "boolean", start, end: this.index, path, value: false, children: [] };
        }
        throw new Error("Invalid JSON boolean");
    }

    private parseNull(path: JsonPathSegment[]): JsonLocationNode {
        const start = this.index;
        if (!this.source.startsWith("null", this.index)) {
            throw new Error("Invalid JSON null");
        }
        this.index += 4;
        return { type: "null", start, end: this.index, path, value: null, children: [] };
    }

    private skipWhitespace() {
        while (/\s/.test(this.source[this.index] || "")) {
            this.index++;
        }
    }

    private expect(char: string) {
        if (this.source[this.index] !== char) {
            throw new Error(`Expected "${char}"`);
        }
        this.index++;
    }
}

export const parseJsonLocations = (source: string): JsonLocationNode => {
    return new JsonLocationParser(source).parse();
};

const containsOffset = (start: number, end: number, offset: number) => offset >= start && offset <= end;

export const findJsonNodeAtOffset = (source: string, offset: number): JsonLocationNode | null => {
    try {
        const root = parseJsonLocations(source);
        const find = (node: JsonLocationNode): JsonLocationNode | null => {
            for (const child of node.children) {
                if (
                    child.keyStart !== undefined
                    && child.keyEnd !== undefined
                    && containsOffset(child.keyStart, child.keyEnd, offset)
                ) {
                    return child;
                }
                if (containsOffset(child.start, child.end, offset)) {
                    return find(child) || child;
                }
            }
            return containsOffset(node.start, node.end, offset) ? node : null;
        };
        return find(root);
    } catch {
        return null;
    }
};

const quotePathKey = (key: string) => key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

export const formatJsonPath = (path: JsonPathSegment[]): string => {
    return path.reduce<string>((result, segment) => {
        if (typeof segment === "number") {
            return `${result}[${segment}]`;
        }
        if (/^[a-z_]\w*$/i.test(segment)) {
            return `${result}.${segment}`;
        }
        return `${result}["${quotePathKey(segment)}"]`;
    }, "$");
};

export const formatJsonNodeValue = (value: any): string => {
    if (typeof value === "string") {
        return value;
    }
    if (value === undefined) {
        return "";
    }
    if (value === null || typeof value !== "object") {
        return String(value);
    }
    return JSON.stringify(value, null, 4);
};

const quoteJmesIdentifier = (key: string) => {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }
    return `"${quotePathKey(key)}"`;
};

type JmesSegment = string | "[]";

const formatJmesPath = (path: JmesSegment[]) => {
    let result = "";
    path.forEach(segment => {
        if (segment === "[]") {
            result += "[]";
            return;
        }
        const part = quoteJmesIdentifier(segment);
        result += result === "" ? part : `.${part}`;
    });
    return result;
};

const collectObjectKeys = (value: any): string[] => {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.flatMap(item => collectObjectKeys(item))));
    }
    if (value !== null && typeof value === "object") {
        return Object.keys(value);
    }
    return [];
};

export type JmesPathSuggestion = {
    label: string;
    insertText: string;
    detail: string;
    type: "field" | "function";
};

const collectFieldSuggestions = (
    value: any,
    path: JmesSegment[] = [],
    depth = 0,
    result = new Map<string, JmesPathSuggestion>(),
) => {
    if (depth > 4) {
        return result;
    }
    if (Array.isArray(value)) {
        const arrayPath = path.length > 0 ? [...path, "[]" as const] : path;
        if (arrayPath.length > 0) {
            const text = formatJmesPath(arrayPath);
            result.set(text, { label: text, insertText: text, detail: "array projection", type: "field" });
        }
        value.slice(0, 20).forEach(item => collectFieldSuggestions(item, arrayPath, depth + 1, result));
        return result;
    }
    if (value === null || typeof value !== "object") {
        return result;
    }
    Object.keys(value).forEach(key => {
        const nextPath = [...path, key];
        const text = formatJmesPath(nextPath);
        result.set(text, { label: text, insertText: text, detail: "JSON field", type: "field" });
        collectFieldSuggestions(value[key], nextPath, depth + 1, result);
    });
    return result;
};

export const jmesPathFunctions: JmesPathSuggestion[] = [
    "abs", "avg", "ceil", "contains", "ends_with", "floor", "length", "map", "max", "merge",
    "max_by", "sum", "starts_with", "min", "min_by", "type", "keys", "values", "sort", "sort_by",
    "join", "reverse", "to_array", "to_string", "to_number", "not_null",
].map(name => ({
    label: `${name}()`,
    insertText: `${name}($1)`,
    detail: "JMESPath function",
    type: "function",
}));

const expressionBeforeMemberAccess = (text: string) => {
    const trimmed = text.trimEnd();
    if (!trimmed.endsWith(".")) {
        return null;
    }
    return trimmed.slice(0, -1).trim();
};

export const getJmesPathSuggestions = (json: any, expression: string): JmesPathSuggestion[] => {
    const memberExpression = expressionBeforeMemberAccess(expression);
    if (memberExpression !== null) {
        try {
            const target = memberExpression === "" ? json : jmespath.search(json, memberExpression);
            return collectObjectKeys(target).map(key => ({
                label: quoteJmesIdentifier(key),
                insertText: quoteJmesIdentifier(key),
                detail: "JSON field",
                type: "field",
            }));
        } catch {
            return [];
        }
    }
    return [
        ...Array.from(collectFieldSuggestions(json).values()),
        ...jmesPathFunctions,
    ];
};
