import qs from "qs";
import csv from "./csv";
import table from "./table";
import { fromString as readerPhpArray } from "php-array-reader";
import propertiesToJSON from "./propertiesToJson";
import jsonToPropertiesParser from "json-to-properties/src/scripts/parser";
import yaml from "./yaml";
import phpArray from "./phpArray";
import toml from "@ltd/j-toml";
import xml from "./xml";
import phpSerialize from "./phpSerialize";
import { isEmpty, isObject, isArray } from "lodash";
import Json from "@/helper/json";

type  ContentType = any[] | { [key: string]: any } | [] | {}

type Option = Record<string, any>

class Serialize<T extends ContentType = ContentType> {
    _content: T;
    _error: string | null;

    private constructor(
        _content: T,
        _error: string | null = null,
    ) {
        this._content = _content;
        this._error = _error;
    }

    static formCallback<T extends ContentType = ContentType>(callback: () => T, error: string = "") {
        try {
            if (error !== "") {
                return Serialize.fromError(error);
            }
            const result = callback();
            if (!isObject(result)) {
                throw new Error("input parse fail");
            }
            return new Serialize<T>(result);
        } catch (e) {
            console.error(e);
            return Serialize.fromError($error(e));
        }
    }

    static fromError(str: string) {
        return new Serialize({}, str);
    }

    static empty() {
        return new Serialize({});
    }

    static formObject(value: Object) {
        return Serialize.formCallback(() => {
            return value;
        });
    }

    static formJson<T extends ContentType = ContentType>(str: string) {
        return Serialize.formCallback<T>(() => {
            return Json.parse(str, { JSON_REPAIR: true });
        });
    }

    static formQueryString<T extends ContentType = ContentType>(str: string) {
        return Serialize.formCallback<T>(() => {
            return qs.parse(str) as T;
        });
    }

    static formCsv<T extends ContentType = ContentType>(str: string, {
        type = "row_object",
        keyed_key = 0,
    }: Option = {}) {
        return Serialize.formCallback<T>(() => {
            return csv.parse(str, { type, keyed_key });
        });
    }

    static formTable<T extends ContentType = ContentType>(str: string, {
        type = "row_object",
        keyed_key = 0,
    }: Option = {}) {
        return Serialize.formCallback<T>(() => {
            return table.parse(str, { type, keyed_key });
        });
    }

    static formXml<T extends ContentType = ContentType>(str: string, { attribute_prefix = "" }: Option = {}) {
        return Serialize.formCallback<T>(() => {
            return xml.parse(str, { attribute_prefix });
        });
    }

    static formYaml<T extends ContentType = ContentType>(str: string) {
        return Serialize.formCallback<T>(() => {
            return yaml.load(str) as T;
        });
    }

    static formPhpArray<T extends ContentType = ContentType>(str: string) {
        // 预处理：将 PHP array() 语法转换为短数组语法 []
        // 以兼容 php-array-reader 库（仅支持 [] 语法）
        const preprocessed = Serialize.convertPhpArraySyntax(str);
        return Serialize.formCallback<T>(() => readerPhpArray(preprocessed));
    }

    // 将 PHP array(...) 语法转换为 [...] 短数组语法
    private static convertPhpArraySyntax(str: string): string {
        let result = '';
        let i = 0;
        const len = str.length;
        // 预编译正则，复用以提高性能
        const arrayRegex = /^array\s*\(/i;

        // 尝试在当前位置匹配 array( 关键字，使用有界切片避免 O(n) 子串创建
        const tryMatchArray = (pos: number): number => {
            const ch = str[pos];
            if (ch !== 'a' && ch !== 'A') return 0;
            // "array (" 最长约 20 字符（含空格），取有界子串匹配
            const slice = str.substring(pos, pos + 20);
            const m = slice.match(arrayRegex);
            return m ? m[0].length : 0;
        };

        while (i < len) {
            const matchLen = tryMatchArray(i);
            if (matchLen > 0) {
                result += '[';
                i += matchLen;
                // 找到匹配的右括号并替换为 ]
                let depth = 1;
                let inString: string | false = false;
                let escaped = false;
                while (i < len && depth > 0) {
                    const ch = str[i];
                    if (escaped) {
                        result += ch;
                        escaped = false;
                        i++;
                        continue;
                    }
                    if (ch === '\\' && inString) {
                        escaped = true;
                        result += ch;
                        i++;
                        continue;
                    }
                    if ((ch === '"' || ch === "'") && !inString) {
                        inString = ch;
                    } else if (ch === inString) {
                        inString = false;
                    }
                    if (!inString) {
                        // 递归处理嵌套 array(
                        const innerLen = tryMatchArray(i);
                        if (innerLen > 0) {
                            result += '[';
                            i += innerLen;
                            depth++;
                            continue;
                        }
                        if (ch === '(') {
                            depth++;
                        } else if (ch === ')') {
                            depth--;
                            if (depth === 0) {
                                result += ']';
                                i++;
                                continue;
                            }
                        }
                    }
                    result += ch;
                    i++;
                }
            } else {
                result += str[i];
                i++;
            }
        }
        return result;
    }

    static formPhpSerialize<T extends ContentType = ContentType>(str: string) {
        return Serialize.formCallback<T>(() => {
            return phpSerialize.parse<T>(str);
        });
    }

    static formToml<T extends ContentType = ContentType>(str: string) {
        return Serialize.formCallback<T>(() => {
            return toml.parse(str) as T;
        });
    }

    static formProperties<T extends ContentType = ContentType>(str: string, { convertToJsonTree = false }: Option = {}) {
        return Serialize.formCallback<T>(() => {
            return propertiesToJSON(str, { convertToJsonTree });
        });
    }

    toJson() {
        return Json.stringify(this.content());
    }

    toQueryString() {
        return qs.stringify(this.content());
    }

    toCsv({ quoted = false, header = true }: Option = {}) {
        return csv.stringify(this.content(), { quoted, header });
    }

    toText({ delimiter = ",\\n", is_add_quote = false }: Option = {}) {
        if (this.isEmpty()) {
            return "";
        }
        const content = this.content();
        if (!isArray(content)) {
            throw new Error("Content Only Support Array");
        }
        return content.map((item: any) => {
            return is_add_quote ? `"${item}"` : item;
        }).join(delimiter.replace(/\\n/g, "\n"));
    }

    toTable({ header = true }: Option = {}) {
        return table.stringify(this.content(), { header });
    }

    toXml({ attribute_prefix = "" }: Option = {}) {
        return xml.stringify(this.content(), { attribute_prefix });
    }

    toYaml() {
        return yaml.dump(this.content());
    }

    toPhpSerialize() {
        return phpSerialize.stringify(this.content());
    }

    toPhpArray() {
        return phpArray.stringify(this.content());
    }

    toToml() {
        return toml.stringify(this.content() as any, { newline: "\n", integer: Number.MAX_SAFE_INTEGER });
    }

    toProperties() {
        return jsonToPropertiesParser.deflate(this.content()).join("\n") as string;
    }

    content() {
        return this._content;
    }

    isError() {
        return this._error !== null;
    }

    error() {
        return this._error || "";
    }

    isEmpty() {
        return isEmpty(this.content());
    }
}

export default Serialize;
