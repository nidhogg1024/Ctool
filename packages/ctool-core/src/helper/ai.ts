import {FeatureInterface, FeatureType, getTool, toolExists, ToolType} from "@/config";

const AI_SUPPORTED_FEATURES = [
    {tool: "json", feature: "json"},
    {tool: "regex", feature: "regex"},
    {tool: "crontab", feature: "crontab"},
    {tool: "sqlFillParameter", feature: "sqlFillParameter"},
    {tool: "stacktrace", feature: "stacktrace"},
    {tool: "configConvert", feature: "configConvert"},
    {tool: "httpSnippet", feature: "httpSnippet"},
    {tool: "code", feature: "code"},
    {tool: "text", feature: "text"},
    {tool: "diffs", feature: "diffs"},
    {tool: "urlParse", feature: "urlParse"},
    {tool: "userAgent", feature: "userAgent"},
] as const satisfies ReadonlyArray<{ tool: ToolType, feature: FeatureType }>

const aiFeatureMap = AI_SUPPORTED_FEATURES.reduce((map, item) => {
    const features = map.get(item.tool) || new Set<string>()
    features.add(item.feature)
    map.set(item.tool, features)
    return map
}, new Map<ToolType, Set<string>>())

export const AI_FEATURE_COUNT = AI_SUPPORTED_FEATURES.length
export const AI_TOOL_COUNT = aiFeatureMap.size

export const getAiSupportedFeatures = (): FeatureInterface[] => {
    return AI_SUPPORTED_FEATURES.map(({tool, feature}) => getTool(tool).getFeature(feature))
}

export const toolSupportsAi = (tool: string): tool is ToolType => {
    return toolExists(tool) && aiFeatureMap.has(tool)
}

export const featureSupportsAi = (tool: string, feature?: string): boolean => {
    if (!toolExists(tool)) {
        return false
    }
    const features = aiFeatureMap.get(tool)
    if (!features) {
        return false
    }
    if (!feature) {
        return true
    }
    return features.has(feature)
}
