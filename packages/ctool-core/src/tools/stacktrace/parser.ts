/**
 * 堆栈信息解析器
 * - 专用解析器：Java、Python、JavaScript、Go（高精度）
 * - 通用兜底解析器：C#、Ruby、PHP、Rust 及任何含 file:line 格式的堆栈
 * - 支持从 JSON 日志（GCP、ELK、Datadog 等）中自动提取堆栈
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

/** 从 JSON 日志中提取的元信息 */
export interface LogMeta {
    [key: string]: string;
}

/** 预处理结果 */
export interface PreprocessResult {
    /** 提取/清理后的堆栈文本 */
    stackText: string;
    /** JSON 日志中提取的元信息（仅 JSON 输入时存在） */
    meta?: LogMeta;
}

// ===================== 正则定义 ===================== //

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

// Go: 位置行以 tab 缩进开头
const GO_LOCATION = /^\s+(.+?):(\d+)(?:\s|$)/;

// C#: "at Namespace.Class.Method() in /path/file.cs:line 42"
const CSHARP_FRAME = /^\s*at\s+(.+?)\s+in\s+(.+?):line\s+(\d+)/;

// Ruby: "/path/file.rb:42:in `method_name'"
const RUBY_FRAME = /^(.+?):(\d+):in\s+[`'](.+?)'/;

// PHP: "#0 /path/file.php(42): Class->method()"
const PHP_FRAME = /^\s*#\d+\s+(.+?)\((\d+)\):\s*(.+)/;

// Rust: "  N: function_name" + "        at /path/file.rs:42:5"
const RUST_AT_LINE = /^\s+at\s+(.+?):(\d+)(?::\d+)?$/;

// ===================== 预处理 ===================== //

/** 常见的堆栈字段名（按优先级排序） */
const STACK_FIELD_NAMES = [
    'stacktrace', 'stack_trace', 'stackTrace',
    'stack', 'traceback', 'error_stack', 'backtrace',
    // Datadog / Sentry 等
    'error.stack', 'error.stack_trace',
];

/**
 * 从 JSON 对象中递归查找堆栈字段
 * 支持嵌套结构（jsonPayload、error 等）和点号路径（error.stack）
 */
const extractStackFromJson = (obj: any): string | null => {
    if (typeof obj !== 'object' || obj === null) return null;

    // 当前层级查找
    for (const key of STACK_FIELD_NAMES) {
        // 处理点号路径 "error.stack"
        if (key.includes('.')) {
            const parts = key.split('.');
            let current = obj;
            for (const part of parts) {
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    current = undefined;
                    break;
                }
            }
            if (typeof current === 'string' && (current.includes('\n') || current.includes('\\n'))) {
                return current;
            }
        } else if (key in obj && typeof obj[key] === 'string') {
            const val = obj[key];
            if (val.includes('\n') || val.includes('\\n')) {
                return val;
            }
        }
    }

    // 递归查找嵌套对象（如 jsonPayload、error、exception 等）
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            const found = extractStackFromJson(obj[key]);
            if (found) return found;
        }
    }

    return null;
};

/**
 * 从 JSON 日志中提取有用的元信息
 */
const extractMeta = (json: any): LogMeta | undefined => {
    const payload = json.jsonPayload || json.payload || json;
    const meta: LogMeta = {};

    // 消息/错误
    if (payload.msg) meta['message'] = payload.msg;
    if (payload.message && payload.message !== payload.msg) meta['message'] = payload.message;
    if (payload.error) meta['error'] = payload.error;
    if (payload.level) meta['level'] = payload.level;
    if (payload.caller) meta['caller'] = payload.caller;

    // 请求上下文
    if (payload.trace_id || payload.traceId) meta['trace_id'] = payload.trace_id || payload.traceId;
    if (payload.request_id || payload.requestId) meta['request_id'] = payload.request_id || payload.requestId;
    if (payload.url || payload.path) {
        const method = payload.method || '';
        const path = payload.url || payload.path;
        meta['request'] = `${method} ${path}`.trim();
    }
    if (payload.client_ip) meta['client_ip'] = payload.client_ip;

    // 时间/来源
    if (json.timestamp) meta['timestamp'] = json.timestamp;
    const resource = json.resource;
    if (resource?.labels?.service_name) meta['service'] = resource.labels.service_name;

    return Object.keys(meta).length > 0 ? meta : undefined;
};

/**
 * 预处理输入文本
 */
export const preprocessInput = (text: string): PreprocessResult => {
    const trimmed = text.trim();

    // 1. 尝试从 JSON 中提取
    if (trimmed.startsWith('{')) {
        try {
            const json = JSON.parse(trimmed);
            const stackText = extractStackFromJson(json);
            if (stackText) {
                const cleaned = stackText.includes('\\n')
                    ? stackText.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
                    : stackText;
                return { stackText: cleaned, meta: extractMeta(json) };
            }
        } catch {
            // 不是合法 JSON，继续
        }
    }

    // 2. 处理 literal \n \t
    if (trimmed.includes('\\n')) {
        return {
            stackText: trimmed.replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
        };
    }

    return { stackText: trimmed };
};

// ===================== 专用语言解析器 ===================== //

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
            const methodLine = i > 0 ? lines[i - 1].trim() : "";
            const method = methodLine.replace(/\(.*\)$/, "");
            result.frames.push({ method: method || "-", file: locMatch[1], line: locMatch[2], raw: lines[i].trim() });
        }
    }
    return result;
};

// ===================== 通用兜底解析器 ===================== //

/**
 * 尝试从单行中提取堆栈帧
 * 按特征明确度从高到低依次匹配：C# → Ruby → PHP → Rust → 通用 file:line
 */
const parseGenericLine = (line: string): StackFrame | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let m: RegExpMatchArray | null;

    // C#: "at Namespace.Class.Method() in /path/file.cs:line 42"
    m = trimmed.match(CSHARP_FRAME);
    if (m) return { method: m[1], file: m[2], line: m[3], raw: trimmed };

    // Ruby: "/path/file.rb:42:in `method_name'"
    m = trimmed.match(RUBY_FRAME);
    if (m) return { method: m[3], file: m[1], line: m[2], raw: trimmed };

    // PHP: "#0 /path/file.php(42): Class->method()"
    m = trimmed.match(PHP_FRAME);
    if (m) return { method: m[3], file: m[1], line: m[2], raw: trimmed };

    // Rust: "at /path/file.rs:42:5"（通常是 backtrace 中 "N: fn_name" 下一行）
    m = trimmed.match(RUST_AT_LINE);
    if (m) return { method: "-", file: m[1], line: m[2], raw: trimmed };

    // Java 风格（也匹配 Kotlin 等 JVM 语言）
    m = trimmed.match(JAVA_FRAME);
    if (m) return { method: m[1], file: m[2], line: m[3], raw: trimmed };

    // JS 风格（Chrome V8、Node、Safari JSC、Firefox Gecko）
    m = trimmed.match(JS_FRAME_NAMED);
    if (m) return { method: m[1], file: m[2], line: m[3], raw: trimmed };

    // Firefox/Safari: "functionName@file:line:col"
    m = trimmed.match(/^(.+?)@(.+?):(\d+)(?::\d+)?$/);
    if (m) return { method: m[1] || "-", file: m[2], line: m[3], raw: trimmed };

    // 通用兜底：任何包含 路径/文件名.扩展名:行号 的行
    // 匹配绝对路径、相对路径、Windows 路径
    m = trimmed.match(/((?:\/|\.\.?\/|[A-Za-z]:\\)[^\s:()]+?\.[a-zA-Z0-9]{1,10}):(\d+)/);
    if (m) {
        // 从 file:line 前面提取方法名
        const beforeIdx = trimmed.indexOf(m[0]);
        const before = trimmed.substring(0, beforeIdx).trim()
            .replace(/^(at|in|from|#\d+)\s+/i, '')
            .replace(/[()]+$/, '')
            .trim();
        return { method: before || "-", file: m[1], line: m[2], raw: trimmed };
    }

    // 最宽泛兜底：file.ext:line（无路径分隔符，但要有扩展名）
    m = trimmed.match(/\b([a-zA-Z0-9_.-]+\.[a-zA-Z]{1,10}):(\d+)\b/);
    if (m) {
        const beforeIdx = trimmed.indexOf(m[0]);
        const before = trimmed.substring(0, beforeIdx).trim()
            .replace(/^(at|in|from|#\d+)\s+/i, '')
            .replace(/[()]+$/, '')
            .trim();
        return { method: before || "-", file: m[1], line: m[2], raw: trimmed };
    }

    return null;
};

/**
 * 通用解析器：逐行尝试所有已知格式，能解析就解析
 */
const parseGeneric = (lines: string[]): ParsedStack => {
    const result: ParsedStack = { language: "Generic", exception: "", message: "", frames: [] };

    // 尝试从开头几行提取异常信息
    for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i].trim();
        // 通用异常格式：XxxException / XxxError: message
        const excMatch = line.match(/^([\w.]+(?:Exception|Error|Fault|Panic|Warning)[^:]*):?\s*(.*)/);
        if (excMatch) {
            result.exception = excMatch[1];
            result.message = excMatch[2] || "";
            break;
        }
        // Rust: thread 'name' panicked at 'message'
        const rustPanic = line.match(/^thread\s+'(.+?)'\s+panicked\s+at\s+'(.+?)'/);
        if (rustPanic) {
            result.exception = "panic";
            result.message = rustPanic[2];
            break;
        }
        // PHP: PHP Fatal error: xxx in file:line
        const phpErr = line.match(/^PHP\s+(\w+\s+\w+):\s*(.*)/);
        if (phpErr) {
            result.exception = phpErr[1];
            result.message = phpErr[2];
            break;
        }
    }

    // Rust backtrace 特殊处理：编号行是函数名，下一行 at 是位置
    // 格式：
    //   0: function_name
    //            at /path/file.rs:42:5
    for (let i = 0; i < lines.length; i++) {
        const rustFnMatch = lines[i].match(/^\s*(\d+):\s+(.+)$/);
        if (rustFnMatch && i + 1 < lines.length) {
            const atMatch = lines[i + 1].match(RUST_AT_LINE);
            if (atMatch) {
                result.frames.push({ method: rustFnMatch[2], file: atMatch[1], line: atMatch[2], raw: lines[i].trim() });
                i++; // 跳过 at 行
                continue;
            }
        }
        // Go zap 格式：函数名行 + tab缩进位置行
        const goLocMatch = lines[i].match(GO_LOCATION);
        if (goLocMatch) {
            const methodLine = i > 0 ? lines[i - 1].trim() : "";
            const method = methodLine.replace(/\(.*\)$/, "");
            if (method && !method.match(/^\d+:/) && !method.match(/^(at|in|from)\s/i)) {
                result.frames.push({ method, file: goLocMatch[1], line: goLocMatch[2], raw: lines[i].trim() });
                continue;
            }
        }
        // 逐行通用匹配
        const frame = parseGenericLine(lines[i]);
        if (frame) {
            result.frames.push(frame);
        }
    }

    // 尝试从文件扩展名推断语言
    if (result.frames.length > 0) {
        result.language = guessLanguageFromFrames(result.frames);
    }

    return result;
};

/** 根据堆栈帧中的文件扩展名推断语言 */
const guessLanguageFromFrames = (frames: StackFrame[]): string => {
    const extCount: Record<string, number> = {};
    for (const frame of frames) {
        const extMatch = frame.file.match(/\.([a-zA-Z0-9]+)$/);
        if (extMatch) {
            const ext = extMatch[1].toLowerCase();
            extCount[ext] = (extCount[ext] || 0) + 1;
        }
    }
    // 找出现最多的扩展名
    let maxExt = '';
    let maxCount = 0;
    for (const [ext, count] of Object.entries(extCount)) {
        if (count > maxCount) {
            maxExt = ext;
            maxCount = count;
        }
    }
    const extToLang: Record<string, string> = {
        'java': 'Java', 'kt': 'Kotlin', 'scala': 'Scala', 'groovy': 'Groovy',
        'py': 'Python',
        'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'JavaScript', 'tsx': 'TypeScript', 'mjs': 'JavaScript',
        'go': 'Go',
        'cs': 'C#', 'fs': 'F#', 'vb': 'VB.NET',
        'rb': 'Ruby', 'erb': 'Ruby',
        'php': 'PHP',
        'rs': 'Rust',
        'swift': 'Swift',
        'c': 'C', 'cpp': 'C++', 'cc': 'C++', 'cxx': 'C++', 'h': 'C/C++',
        'ex': 'Elixir', 'exs': 'Elixir',
        'erl': 'Erlang',
        'lua': 'Lua',
        'r': 'R',
        'pl': 'Perl', 'pm': 'Perl',
    };
    return extToLang[maxExt] || 'Generic';
};

// ===================== 语言检测 ===================== //

type LangKey = 'java' | 'python' | 'javascript' | 'go' | 'generic';

const detectLanguage = (text: string): LangKey => {
    // Python: 特征最明显 — File "path", line N
    if (/^\s*File\s+"/m.test(text)) return "python";
    // Go: goroutine / panic / tab 缩进的路径:行号
    if (text.includes("goroutine") || text.includes("panic:") || /^\t.+?:\d+/m.test(text)) return "go";
    // JavaScript: "at func (file:line:col)"
    if (JS_FRAME_NAMED.test(text) || JS_EXCEPTION.test(text)) return "javascript";
    // Java: "at com.xxx.Foo(File.java:42)"
    if (JAVA_FRAME.test(text) || JAVA_EXCEPTION.test(text)) return "java";
    if (text.includes("\tat ")) return "java";
    // Go zap 格式
    if (/\n\s+\/.+?:\d+/m.test(text)) return "go";
    // 其他所有情况 → 通用解析器
    return "generic";
};

// ===================== 主入口 ===================== //

export const parseStackTrace = (text: string): ParsedStack => {
    const lines = text.split("\n");
    const lang = detectLanguage(text);
    switch (lang) {
        case "java": return parseJava(lines);
        case "python": return parsePython(lines);
        case "javascript": return parseJavaScript(lines);
        case "go": return parseGo(lines);
        case "generic": {
            // 通用解析器：尝试所有已知模式
            const result = parseGeneric(lines);
            // 如果通用解析器一个帧都没提取到，退回 JS 解析器兜底
            if (result.frames.length === 0) {
                return parseJavaScript(lines);
            }
            return result;
        }
        default: return parseGeneric(lines);
    }
};
