/**
 * LLM 客户端 - 提供统一的大模型调用接口
 *
 * 支持 OpenAI 兼容格式（含 DeepSeek、通义千问等）和 Ollama 本地模型
 * 支持流式 (SSE) 和非流式两种调用方式
 */

// ============================================================
// 类型定义
// ============================================================

/** AI 服务提供方 */
export type AiProvider = "ollama" | "openai_compatible"

/** AI 配置项 */
export interface AiConfig {
    provider: AiProvider
    baseUrl: string
    apiKey: string
    model: string
}

/** 聊天消息 */
export interface ChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

/** 非流式调用结果 */
export interface ChatResult {
    content: string
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

/** 流式调用的回调 */
export interface StreamCallbacks {
    onToken: (token: string) => void
    onDone: (fullText: string) => void
    onError: (error: Error) => void
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_OLLAMA_URL = "http://localhost:11434"
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b"

export const defaultAiConfig: AiConfig = {
    provider: "ollama",
    baseUrl: DEFAULT_OLLAMA_URL,
    apiKey: "",
    model: DEFAULT_OLLAMA_MODEL,
}

// ============================================================
// Response Extractor - 从 AI 返回的文本中提取有效内容
// ============================================================

/**
 * 从 AI 返回文本中提取 JSON 字符串
 *
 * 大模型经常会在 JSON 外面包裹 Markdown 代码块标记或附带废话，
 * 此函数会逐层尝试提取，尽最大努力拿到合法 JSON
 */
export function extractJSON(raw: string): string {
    const trimmed = raw.trim()

    // 第 1 步：直接尝试解析（最理想情况）
    if (tryParseJSON(trimmed)) {
        return trimmed
    }

    // 第 2 步：提取 ```json ... ``` 或 ``` ... ``` 代码块
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch) {
        const inner = codeBlockMatch[1].trim()
        if (tryParseJSON(inner)) {
            return inner
        }
    }

    // 第 3 步：贪心匹配第一个完整的 JSON 对象或数组
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
        const candidate = jsonMatch[1].trim()
        if (tryParseJSON(candidate)) {
            return candidate
        }
    }

    // 全部失败，返回原文让上层决定如何处理
    return trimmed
}

/**
 * 从 AI 返回文本中提取代码片段（正则表达式、SQL、Cron 等）
 *
 * 剥离 Markdown 代码块标记和常见废话前缀
 */
export function extractCode(raw: string): string {
    const trimmed = raw.trim()

    // 提取代码块（支持任意语言标记）
    const codeBlockMatch = trimmed.match(/```\w*\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim()
    }

    // 提取行内代码
    const inlineCodeMatch = trimmed.match(/^`([^`]+)`$/)
    if (inlineCodeMatch) {
        return inlineCodeMatch[1].trim()
    }

    // 去除常见废话行（中英文），逐行检查，丢弃前导废话行，保留代码行
    const lines = trimmed.split("\n")
    const codeLines: string[] = []
    let foundCode = false

    for (const line of lines) {
        const stripped = line.trim()
        if (!foundCode) {
            // 跳过空行
            if (stripped === "") continue
            // 跳过以冒号/句号结尾的引导性语句（如"好的，以下是生成的表达式："、"Here's the result:"）
            if (/[：:。.]$/.test(stripped) && /^.*(?:好的|以下是|这是|结果|生成|here|result|output|pattern|expression|following)/i.test(stripped)) {
                continue
            }
            foundCode = true
            codeLines.push(stripped)
        } else {
            codeLines.push(line)
        }
    }

    return codeLines.join("\n").trim() || trimmed
}

function tryParseJSON(str: string): boolean {
    try {
        JSON.parse(str)
        return true
    } catch {
        return false
    }
}

// ============================================================
// SSE 流式解析器
// ============================================================

/**
 * 解析 SSE 流中的单行 data 事件
 *
 * OpenAI 兼容格式：data: {"choices":[{"delta":{"content":"..."}}]}
 * Ollama 格式：{"message":{"content":"..."}}（每行一个 JSON，非标准 SSE）
 */
export function parseSSELine(line: string, provider: AiProvider): string | null {
    if (!line || line.startsWith(":")) {
        // 空行或 SSE 注释行，跳过
        return null
    }

    if (line === "data: [DONE]") {
        return null
    }

    // OpenAI 兼容格式
    if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6)
        try {
            const data = JSON.parse(jsonStr)
            return data?.choices?.[0]?.delta?.content ?? null
        } catch {
            return null
        }
    }

    // Ollama 原生流式格式（每行直接是一个 JSON 对象）
    if (provider === "ollama") {
        try {
            const data = JSON.parse(line)
            if (data.done) return null
            return data?.message?.content ?? null
        } catch {
            return null
        }
    }

    return null
}

// ============================================================
// LLM 客户端核心
// ============================================================

/**
 * 构建请求 URL
 */
function buildUrl(config: AiConfig): string {
    const base = config.baseUrl.replace(/\/+$/, "")

    if (config.provider === "ollama") {
        return `${base}/api/chat`
    }

    // OpenAI 兼容格式
    // 兼容用户输入了 /v1 或 /v1/ 或 /v1/chat/completions 的情况
    if (base.endsWith("/chat/completions")) {
        return base
    }
    if (base.endsWith("/v1")) {
        return `${base}/chat/completions`
    }
    return `${base}/v1/chat/completions`
}

/**
 * 构建请求 body
 */
function buildRequestBody(messages: ChatMessage[], config: AiConfig, stream: boolean): string {
    if (config.provider === "ollama") {
        return JSON.stringify({
            model: config.model,
            messages,
            stream,
        })
    }

    // OpenAI 兼容格式
    return JSON.stringify({
        model: config.model,
        messages,
        stream,
        temperature: 0.3,
    })
}

/**
 * 构建请求 headers
 */
function buildHeaders(config: AiConfig): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (config.provider === "openai_compatible" && config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`
    }

    return headers
}

/**
 * 非流式调用 LLM
 */
export async function chat(messages: ChatMessage[], config: AiConfig): Promise<ChatResult> {
    const url = buildUrl(config)
    const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(config),
        body: buildRequestBody(messages, config, false),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new Error(`AI 请求失败 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (config.provider === "ollama") {
        return {
            content: data?.message?.content ?? "",
            usage: data?.eval_count ? {
                prompt_tokens: data.prompt_eval_count ?? 0,
                completion_tokens: data.eval_count ?? 0,
                total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            } : undefined,
        }
    }

    // OpenAI 兼容格式
    return {
        content: data?.choices?.[0]?.message?.content ?? "",
        usage: data?.usage,
    }
}

/**
 * 流式调用 LLM
 *
 * 返回一个 AbortController，调用 abort() 可取消请求
 */
export function streamChat(
    messages: ChatMessage[],
    config: AiConfig,
    callbacks: StreamCallbacks,
): AbortController {
    const controller = new AbortController()

    const run = async () => {
        const url = buildUrl(config)
        const response = await fetch(url, {
            method: "POST",
            headers: buildHeaders(config),
            body: buildRequestBody(messages, config, true),
            signal: controller.signal,
        })

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText)
            throw new Error(`AI 请求失败 (${response.status}): ${errorText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
            throw new Error("响应体不支持流式读取")
        }

        const decoder = new TextDecoder()
        let fullText = ""
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // 按换行符拆分，处理每一行
            const lines = buffer.split("\n")
            // 最后一个元素可能是未完成的行，保留在 buffer 中
            buffer = lines.pop() ?? ""

            for (const line of lines) {
                const token = parseSSELine(line.trim(), config.provider)
                if (token !== null) {
                    fullText += token
                    callbacks.onToken(token)
                }
            }
        }

        // 处理 buffer 中残留的数据
        if (buffer.trim()) {
            const token = parseSSELine(buffer.trim(), config.provider)
            if (token !== null) {
                fullText += token
                callbacks.onToken(token)
            }
        }

        callbacks.onDone(fullText)
    }

    run().catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
            // 用户主动取消，不算错误
            return
        }
        callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    })

    return controller
}
