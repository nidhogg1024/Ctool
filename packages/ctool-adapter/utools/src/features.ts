import { FeatureInterface, tools } from "ctool-config";
import { CustomCmd, customCmds } from "./config";

export type FeatureItem = {
    feature: FeatureInterface,
    cmds: string[],
};

export type UtoolsFeature = {
    code: string,
    explain: string,
    platform?: "darwin" | "win32" | "linux" | ("darwin" | "win32" | "linux")[],
    cmds: (string | (CustomCmd & {label: string}))[],
};

export type UtoolsFeatureSnapshot = {
    code: string,
    explain?: string,
    platform?: string | string[],
    icon?: string,
    mainHide?: boolean,
    mainPush?: boolean,
    cmds: unknown,
};

export type Translate = (key: string) => string;

export const primaryFeature: UtoolsFeature = {
    code: "ctool",
    explain: "程序开发常用工具（增强版）",
    cmds: ["ctool", "ctool plus", "程序开发常用工具"],
};

export const releaseFeatures: UtoolsFeature[] = [primaryFeature];

export const legacyMainFeature: UtoolsFeature = {
    code: "Ctool",
    explain: "ctool - 程序开发常用工具",
    cmds: ["Ctool"],
};

export const isCustomizeFeatureCode = (code: string): boolean => {
    return code.startsWith("ctool-") && code.endsWith("-customize");
};

const getFeatureExplanation = (feature: FeatureInterface, translate: Translate): string => {
    return `${feature.tool.isSimple() ? "" : translate(`tool_${feature.tool.name}`) + " - "}${translate(`tool_${feature.tool.name}_${feature.name}`)}`;
};

export const buildAllFeatureItems = (translate: Translate): FeatureItem[] => {
    const features: FeatureItem[] = [];
    tools.forEach(tool => {
        tool.features.forEach(feature => {
            features.push({
                feature,
                cmds: [
                    ...(
                        new Set([
                            tool.name,
                            feature.name,
                            tool.isSimple() ? `ctool-${tool.name}` : `ctool-${tool.name}-${feature.name}`,
                            translate(`tool_${tool.name}`),
                            translate(`tool_${tool.name}_${feature.name}`),
                            ...translate(`tool_${tool.name}_${feature.name}_keywords`).split(","),
                            `${tool.isSimple() ? "" : translate(`tool_${tool.name}`) + " - "}${translate(`tool_${tool.name}_${feature.name}`)}`,
                        ].map(item => item.trim().toLowerCase()).filter(item => item !== ""))
                    ),
                ],
            });
        });
    });
    return features;
};

export const buildContentTriggerFeatures = (translate: Translate): UtoolsFeature[] => {
    return [...customCmds].map(([feature, cmds]) => {
        const explain = getFeatureExplanation(feature, translate);
        return {
            code: `ctool-${feature.getKey()}-content`,
            explain,
            platform: ["darwin", "win32", "linux"],
            cmds: cmds.map(cmd => ({...cmd, label: explain})),
        };
    });
};

const contentTriggerFeatureCodes = new Set(
    [...customCmds.keys()].map(feature => `ctool-${feature.getKey()}-content`),
);

export const isContentTriggerFeatureCode = (code: string): boolean => {
    return contentTriggerFeatureCodes.has(code);
};

export const toCustomizeFeature = ({ feature, cmds }: FeatureItem, translate: Translate): UtoolsFeature => {
    return {
        code: `ctool-${feature.getKey()}-customize`,
        explain: getFeatureExplanation(feature, translate),
        platform: ["darwin", "win32", "linux"],
        cmds,
    };
};

export const buildLegacyDynamicFeatures = (translate: Translate): UtoolsFeature[] => {
    return buildAllFeatureItems(translate).map(item => toCustomizeFeature(item, translate));
};

export const getStringCommands = (cmds: unknown): string[] => {
    if (!Array.isArray(cmds) || cmds.some(item => typeof item !== "string")) {
        return [];
    }
    return cmds;
};

export const isLegacyMainFeature = (feature: UtoolsFeatureSnapshot): boolean => {
    return feature.code === legacyMainFeature.code;
};
