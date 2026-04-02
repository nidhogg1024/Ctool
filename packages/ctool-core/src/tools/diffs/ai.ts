export interface DiffSummaryPromptInput {
    language: string
    original: string
    modified: string
}

const TEXT_LIKE_LANGUAGES = new Set([
    "",
    "text",
    "plaintext",
    "plain text",
    "markdown",
    "md",
])

const CODE_HINT_PATTERNS = [
    /\b(function|class|const|let|var|return|import|export|SELECT|INSERT|UPDATE|DELETE)\b/i,
    /[{}()[\];<>]/,
    /=>|::|===|!==|&&|\|\|/,
]

export const isCodeLikeDiff = ({ language, original, modified }: DiffSummaryPromptInput): boolean => {
    const normalizedLanguage = language.trim().toLowerCase()
    if (!TEXT_LIKE_LANGUAGES.has(normalizedLanguage)) {
        return true
    }

    const combined = `${original}\n${modified}`
    const hintCount = CODE_HINT_PATTERNS.reduce((count, pattern) => {
        return count + (pattern.test(combined) ? 1 : 0)
    }, 0)

    return hintCount >= 2
}

export const buildDiffSummaryPrompt = (input: DiffSummaryPromptInput): { system: string; user: string; codeLike: boolean } => {
    const codeLike = isCodeLikeDiff(input)

    const system = codeLike
        ? "你是一个代码与文本差异分析助手。请先总结两个版本最核心的变化，再补充可能的行为影响，以及 2-3 个值得验证的点。重点说清楚改了什么，不要写成长篇审查报告。"
        : "你是一个文本差异总结助手。请用简洁中文说明两个版本之间最重要的变化，重点关注新增、删除、语气变化和信息重点变化。不要展开风险分析，也不要给测试建议。"

    const user = `Language: ${input.language}\n\nOriginal:\n${input.original}\n\nModified:\n${input.modified}`

    return {
        system,
        user,
        codeLike,
    }
}
