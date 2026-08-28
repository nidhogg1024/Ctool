import {
    PlatformRuntime,
    StorageInterface,
    toolExists,
    getTool,
    FeatureInterface,
    tools,
    Initializer,
} from "ctool-config";
import storageUtools from "./storage";
import {
    buildAllFeatureItems,
    buildContentTriggerFeatures,
    FeatureItem,
    getStringCommands,
    isContentTriggerFeatureCode,
    isCustomizeFeatureCode,
    isLegacyMainFeature,
    toCustomizeFeature,
    UtoolsFeatureSnapshot,
} from "./features";

export {
    buildAllFeatureItems,
    buildContentTriggerFeatures,
    buildLegacyDynamicFeatures,
    legacyMainFeature,
    primaryFeature,
    releaseFeatures,
} from "./features";

const $t = (key: string, locale?: "zh_CN" | "en"): string => {
    // @ts-ignore
    return window["$t"](key, [], locale);
};

const setDynamicFeature = (feature: UtoolsFeatureSnapshot): void => {
    // 新版 uTools 返回 void，旧类型定义返回 boolean；最终结果统一由下方回读校验确认。
    const result = window.utools.setFeature(feature as any) as unknown;
    if (result === false) {
        throw new Error(`Failed to set uTools feature: ${feature.code}`);
    }
};

const getDynamicFeatures = (): UtoolsFeatureSnapshot[] => {
    return window.utools.getFeatures() as unknown as UtoolsFeatureSnapshot[];
};

const removeFeature = (code: string): void => {
    if (!window.utools.removeFeature(code)) {
        throw new Error(`Failed to remove uTools feature: ${code}`);
    }
};

const cloneFeature = (feature: UtoolsFeatureSnapshot): UtoolsFeatureSnapshot => {
    return JSON.parse(JSON.stringify(feature)) as UtoolsFeatureSnapshot;
};

const normalizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeValue(item)]),
        );
    }
    return value;
};

const canonicalizeDynamicFeatureSet = (features: UtoolsFeatureSnapshot[]): string | null => {
    const codes = new Set(features.map(feature => feature.code));
    if (codes.size !== features.length) {
        return null;
    }
    return JSON.stringify(
        features
            .map(feature => ({
                code: feature.code,
                explain: feature.explain ?? null,
                platform: Array.isArray(feature.platform)
                    ? [...feature.platform].sort()
                    : feature.platform ?? null,
                icon: feature.icon ?? null,
                mainHide: feature.mainHide ?? null,
                mainPush: feature.mainPush ?? null,
                cmds: (Array.isArray(feature.cmds) ? feature.cmds : [feature.cmds])
                    .map(normalizeValue)
                    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
            }))
            .sort((left, right) => left.code.localeCompare(right.code)),
    );
};

const dynamicFeatureSetsEqual = (
    left: UtoolsFeatureSnapshot[],
    right: UtoolsFeatureSnapshot[],
): boolean => {
    const leftCanonical = canonicalizeDynamicFeatureSet(left);
    const rightCanonical = canonicalizeDynamicFeatureSet(right);
    return leftCanonical !== null && rightCanonical !== null && leftCanonical === rightCanonical;
};

const replaceDynamicFeatures = (
    shouldReplace: (feature: UtoolsFeatureSnapshot) => boolean,
    nextFeatures: UtoolsFeatureSnapshot[],
): void => {
    if (new Set(nextFeatures.map(feature => feature.code)).size !== nextFeatures.length) {
        throw new Error("Duplicate uTools feature codes");
    }

    const previousFeatures = getDynamicFeatures().filter(shouldReplace).map(cloneFeature);
    const previousFeatureMap = new Map(previousFeatures.map(feature => [feature.code, feature]));
    const nextFeatureMap = new Map(nextFeatures.map(feature => [feature.code, feature]));
    const featuresToSet = nextFeatures.filter(feature => {
        const previousFeature = previousFeatureMap.get(feature.code);
        return previousFeature === undefined
            || !dynamicFeatureSetsEqual([previousFeature], [feature]);
    });
    const featureCodesToRemove = previousFeatures
        .filter(feature => !nextFeatureMap.has(feature.code))
        .map(feature => feature.code);
    const affectedCodes = new Set([
        ...previousFeatures.map(feature => feature.code),
        ...nextFeatures.map(feature => feature.code),
    ]);
    const getAffectedFeatures = () => getDynamicFeatures()
        .filter(feature => affectedCodes.has(feature.code));

    const rollback = (): void => {
        getAffectedFeatures()
            .filter(feature => !previousFeatureMap.has(feature.code))
            .forEach(feature => {
                try {
                    window.utools.removeFeature(feature.code);
                } catch {
                }
            });
        previousFeatures.forEach(feature => {
            try {
                window.utools.setFeature(feature as any);
            } catch {
            }
        });
        if (!dynamicFeatureSetsEqual(getAffectedFeatures(), previousFeatures)) {
            throw new Error("Failed to roll back uTools feature configuration");
        }
    };

    try {
        featuresToSet.forEach(setDynamicFeature);
        featureCodesToRemove.forEach(removeFeature);
        if (!dynamicFeatureSetsEqual(getAffectedFeatures(), nextFeatures)) {
            throw new Error("uTools feature configuration verification failed");
        }
    } catch (error) {
        try {
            rollback();
        } catch (rollbackError) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
            );
        }
        throw error;
    }
};

export const runtime = new (class implements PlatformRuntime {
    name = "utools";

    is() {
        return navigator.userAgent.includes("uTools");
    }

    openUrl(url: string) {
        return window.utools.shellOpenExternal(url);
    }

    storage(): StorageInterface {
        return storageUtools;
    }

    getLocale() {
        return "zh_CN";
    }

    initialize(initializer: Initializer) {
        window.utools.onPluginEnter(({ code, type, payload }) => {
            window.utools.showMainWindow();
            if (!code.includes("ctool-")) {
                return;
            }
            const [, _tool, _feature] = code.split("-");
            if (!toolExists(_tool)) {
                return;
            }

            const tool = getTool(_tool);
            if (!tool.existFeature(_feature)) {
                return;
            }
            const feature = tool.getFeature(_feature);

            const query: Record<string, string> = {};
            // 输入框数据写入临时存储
            if (["over", "regex"].includes(type) && payload !== "") {
                initializer.storage().setNoVersion("_temp_input_storage", payload, 10);
            }
            // 设置功能搜索关键字
            if (type === "text" && payload !== "") {
                query.keyword = payload;
            }
            // 添加随机数防止页面不刷新（所有类型都需要，否则目标路由相同时不会触发刷新）
            query["_t"] = `${Math.random()}`;
            initializer.push(feature.getRouter(), query);
        });
    }

    getFeatures() {
        const result = new Map<FeatureInterface, string[]>();
        tools.forEach(tool => {
            tool.features.forEach(feature => result.set(feature, []));
        });
        getDynamicFeatures()
            .filter(item => isCustomizeFeatureCode(item.code))
            .forEach(item => {
                const [, _tool, _feature] = item.code.split("-");
                if (!toolExists(_tool)) {
                    return null;
                }

                const tool = getTool(_tool);
                if (!tool.existFeature(_feature)) {
                    return null;
                }
                const feature = tool.getFeature(_feature);
                result.set(feature, getStringCommands(item.cmds));
            });

        return result;
    }

    resetFeatures() {
        replaceDynamicFeatures(
            feature => isCustomizeFeatureCode(feature.code)
                || isContentTriggerFeatureCode(feature.code)
                || isLegacyMainFeature(feature),
            [],
        );
    }

    enableAllFeatures() {
        const currentFeatures = this.getFeatures();
        const features = buildAllFeatureItems($t).map(({ feature, cmds }) => ({
            feature,
            cmds: [...new Set([...cmds, ...(currentFeatures.get(feature) || [])])],
        }));
        replaceDynamicFeatures(
            feature => isCustomizeFeatureCode(feature.code)
                || isContentTriggerFeatureCode(feature.code)
                || isLegacyMainFeature(feature),
            [
                ...features.map(item => toCustomizeFeature(item, $t)),
                ...buildContentTriggerFeatures($t),
            ],
        );
    }

    setFeatures(features: FeatureItem[]) {
        replaceDynamicFeatures(
            feature => isCustomizeFeatureCode(feature.code) || isLegacyMainFeature(feature),
            features
                .filter(({cmds}) => cmds.length > 0)
                .map(item => toCustomizeFeature(item, $t)),
        );
    }
});
