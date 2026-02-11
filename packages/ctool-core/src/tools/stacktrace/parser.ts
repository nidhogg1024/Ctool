/**
 * 堆栈信息解析器
 * 支持 Java、Python、JavaScript、Go 四种语言
 */

export interface StackFrame {
    file: string;
    line: string;
    method: string;
    raw: string;
}

export interface ParsedStack {
    language: string;
    exception: string;
    message: string;
    frames: StackFrame[];
}

// Java: "at com.example.Foo.bar(Foo.java:42)"
const JAVA_FRAME = /^\s*at\s+(.+)\(([^:]+):(\d+)\)\s*$/;
const JAVA_FRAME_NATIVE = /^\s*at\s+(.+)\((.+)\)\s*$/;
const JAVA_EXCEPTION = /^([\w$.]+(?:Exception|Error|Throwable)[^:]*):?\s*(.*)/;

// Python: '  File "/path/to/file.py", line 42, in func'
const PYTHON_FRAME = /^\s*File\s+"([^"]+)",\s*line\s+(\d+)(?:,\s*in\s+(.+))?/;
const PYTHON_EXCEPTION = /^(\w+(?:Error|Exception|Warning)[^:]*):?\s*(.*)/;

// JavaScript: "at funcName (file.js:10:5)" or "at file.js:10:5"
const JS_FRAME_NAMED = /^\s*at\s+(.+?)\s+\((.+?):(\d+):\d+\)\s*$/;
const JS_FRAME_ANON = /^\s*at\s+(.+?):(\d+):\d+\s*$/;
const JS_EXCEPTION = /^(\w*Error):\s*(.*)/;

// Go: "goroutine 1 [running]:" / "main.go:42 +0x1a"
const GO_LOCATION = /^\s+(.+?):(\d+)\s/;

const parseJava = (lines: string[]): ParsedStack => {
    const result: ParsedStack = { language: "Java", exception: "", message: "", frames: [] };
    for (const line of lines) {
        const excMatch = line.match(JAVA_EXCEPTION);
        if (excMatch && !result.exception) {
            result.exception = excMatch[1];
            result.message = excMatch[2] || "";
            continue;
        }
        const frameMatch = line.match(JAVA_FRAME);
        if (frameMatch) {
            result.frames.push({ method: frameMatch[1], file: frameMatch[2], line: frameMatch[3], raw: line.trim() });
            continue;
        }
        const nativeMatch = line.match(JAVA_FRAME_NATIVE);
        if (nativeMatch) {
            result.frames.push({ method: nativeMatch[1], file: nativeMatch[2], line: "-", raw: line.trim() });
        }
    }
    return result;
};

const parsePython = (lines: string[]): ParsedStack => {
    const result: ParsedStack = { language: "Python", exception: "", message: "", frames: [] };
    for (const line of lines) {
        const excMatch = line.match(PYTHON_EXCEPTION);
        if (excMatch) {
            result.exception = excMatch[1];
            result.message = excMatch[2] || "";
            continue;
        }
        const frameMatch = line.match(PYTHON_FRAME);
        if (frameMatch) {
            result.frames.push({ file: frameMatch[1], line: frameMatch[2], method: frameMatch[3] || "<module>", raw: line.trim() });
        }
    }
    return result;
};

const parseJavaScript = (lines: string[]): ParsedStack => {
    const result: ParsedStack = { language: "JavaScript", exception: "", message: "", frames: [] };
    for (const line of lines) {
        const excMatch = line.match(JS_EXCEPTION);
        if (excMatch && !result.exception) {
            result.exception = excMatch[1];
            result.message = excMatch[2] || "";
            continue;
        }
        const namedMatch = line.match(JS_FRAME_NAMED);
        if (namedMatch) {
            result.frames.push({ method: namedMatch[1], file: namedMatch[2], line: namedMatch[3], raw: line.trim() });
            continue;
        }
        const anonMatch = line.match(JS_FRAME_ANON);
        if (anonMatch) {
            result.frames.push({ method: "<anonymous>", file: anonMatch[1], line: anonMatch[2], raw: line.trim() });
        }
    }
    return result;
};

const parseGo = (lines: string[]): ParsedStack => {
    const result: ParsedStack = { language: "Go", exception: "", message: "", frames: [] };
    // 第一行通常是 "goroutine N [reason]:" 或 panic 信息
    if (lines.length > 0) {
        const first = lines[0].trim();
        if (first.startsWith("goroutine")) {
            result.exception = "goroutine";
            result.message = first;
        } else if (first.startsWith("panic:")) {
            result.exception = "panic";
            result.message = first.replace("panic:", "").trim();
        }
    }
    for (let i = 0; i < lines.length; i++) {
        const locMatch = lines[i].match(GO_LOCATION);
        if (locMatch) {
            // 上一行是方法名
            const methodLine = i > 0 ? lines[i - 1].trim() : "";
            const method = methodLine.replace(/\(.*\)$/, "");
            result.frames.push({ method: method || "-", file: locMatch[1], line: locMatch[2], raw: lines[i].trim() });
        }
    }
    return result;
};

// 自动检测语言
const detectLanguage = (text: string): string => {
    if (text.match(PYTHON_FRAME)) return "python";
    if (text.includes("goroutine") || text.match(GO_LOCATION)) return "go";
    if (text.match(JS_FRAME_NAMED) || text.match(JS_EXCEPTION)) return "javascript";
    if (text.match(JAVA_FRAME) || text.match(JAVA_EXCEPTION)) return "java";
    // 默认按 Java 解析（at xxx 格式最通用）
    if (text.includes("\tat ")) return "java";
    return "javascript";
};

export const parseStackTrace = (text: string): ParsedStack => {
    const lines = text.split("\n");
    const lang = detectLanguage(text);
    switch (lang) {
        case "java": return parseJava(lines);
        case "python": return parsePython(lines);
        case "javascript": return parseJavaScript(lines);
        case "go": return parseGo(lines);
        default: return parseJavaScript(lines);
    }
};
