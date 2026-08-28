import { getTool, tools } from "ctool-config";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    buildContentTriggerFeatures,
    buildLegacyDynamicFeatures,
    legacyMainFeature,
    releaseFeatures,
    runtime,
} from "ctool-adapter-utools";

type DynamicFeature = {
    code: string,
    explain?: string,
    platform?: string | string[],
    icon?: string,
    mainHide?: boolean,
    mainPush?: boolean,
    cmds: unknown,
};

const translate = (key: string) => `zh_CN:${key}`;

const cloneFeature = (feature: DynamicFeature): DynamicFeature => {
    return JSON.parse(JSON.stringify(feature)) as DynamicFeature;
};

const sortFeatures = (features: DynamicFeature[]) => {
    return [...features].sort((left, right) => left.code.localeCompare(right.code));
};

const createUtoolsEnvironment = (initialFeatures: DynamicFeature[] = []) => {
    const features = new Map(initialFeatures.map(item => [item.code, cloneFeature(item)]));
    const utools = {
        getFeatures: vi.fn(() => [...features.values()].map(cloneFeature)),
        setFeature: vi.fn((feature: DynamicFeature): boolean | void => {
            features.set(feature.code, cloneFeature(feature));
        }),
        removeFeature: vi.fn((code: string) => features.delete(code)),
        onPluginEnter: vi.fn(),
        showMainWindow: vi.fn(),
        shellOpenExternal: vi.fn(),
    };
    const windowTranslate = (key: string, _values: unknown[] = [], locale = "zh_CN") => `${locale}:${key}`;
    vi.stubGlobal("window", { utools, $t: windowTranslate });

    return { features, utools };
};

const createInitializer = () => {
    const storage = {
        setNoVersion: vi.fn(),
    };
    return {
        initializer: {
            storage: () => storage,
            push: vi.fn(),
        },
        storage,
    };
};

const allToolFeatures = tools.flatMap(tool => tool.features);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("uTools keyword defaults", () => {
    it("keeps the release manifest limited to the main entry", () => {
        expect(releaseFeatures).toEqual([{
            code: "ctool",
            explain: "程序开发常用工具（增强版）",
            cmds: ["ctool", "ctool plus", "程序开发常用工具"],
        }]);
    });

    it("does not create dynamic features on first install", () => {
        const { features, utools } = createUtoolsEnvironment();
        const { initializer } = createInitializer();

        runtime.initialize(initializer as any);

        expect(features.size).toBe(0);
        expect(utools.getFeatures).not.toHaveBeenCalled();
        expect(utools.setFeature).not.toHaveBeenCalled();
        expect(utools.removeFeature).not.toHaveBeenCalled();
    });

    it.each([75, 80, 85, 87, 89])(
        "preserves an existing %s-feature historical configuration on startup",
        (featureCount) => {
            const existingFeatures = Array.from({length: featureCount}, (_, index) => ({
                code: index === 0 ? "Ctool" : `ctool-legacy-${index}-customize`,
                explain: `legacy-${index}`,
                platform: ["darwin", "win32", "linux"],
                cmds: [`legacy-${index}`],
            }));
            const { features, utools } = createUtoolsEnvironment(existingFeatures);
            const { initializer } = createInitializer();

            runtime.initialize(initializer as any);

            expect([...features.values()]).toEqual(existingFeatures);
            expect(utools.getFeatures).not.toHaveBeenCalled();
            expect(utools.setFeature).not.toHaveBeenCalled();
            expect(utools.removeFeature).not.toHaveBeenCalled();
        },
    );

    it("enables every text entry and the four opt-in content triggers", () => {
        const { features } = createUtoolsEnvironment();

        runtime.enableAllFeatures();

        expect(features.size).toBe(allToolFeatures.length + 4);
        expect(features.has("Ctool")).toBe(false);
        expect([...features.values()].every(feature => Array.isArray(feature.platform))).toBe(true);

        const contentFeatures = [...features.values()]
            .filter(feature => feature.code.endsWith("-content"));
        expect(contentFeatures.map(feature => feature.code).sort()).toEqual([
            "ctool-ip-ip-content",
            "ctool-qrCode-generate-content",
            "ctool-time-timestamp-content",
            "ctool-unicode-decoder-content",
        ]);
        expect(contentFeatures.find(feature => feature.code === "ctool-ip-ip-content")?.cmds)
            .toEqual([expect.objectContaining({type: "regex"})]);
        expect(contentFeatures.find(feature => feature.code === "ctool-qrCode-generate-content")?.cmds)
            .toEqual([expect.objectContaining({type: "over"})]);
    });

    it("keeps content triggers enabled when saving text keywords", () => {
        const { features } = createUtoolsEnvironment();
        runtime.enableAllFeatures();
        const contentFeatureCodes = buildContentTriggerFeatures(translate).map(feature => feature.code);

        runtime.setFeatures([{
            feature: allToolFeatures[0],
            cmds: ["manual-keyword"],
        }]);

        expect(features.size).toBe(1 + contentFeatureCodes.length);
        expect(contentFeatureCodes.every(code => features.has(code))).toBe(true);
        expect(features.get(`ctool-${allToolFeatures[0].getKey()}-customize`)?.cmds)
            .toEqual(["manual-keyword"]);
    });

    it("restores the minimal default only after an explicit action", () => {
        const managedFeatures: DynamicFeature[] = [
            ...buildLegacyDynamicFeatures(translate).slice(0, 2),
            {...legacyMainFeature, cmds: ["manually-changed-main"]},
            ...buildContentTriggerFeatures(translate),
        ];
        const unmanagedFeature: DynamicFeature = {
            code: "manual-unmanaged-feature",
            explain: "keep me",
            platform: "darwin",
            icon: "manual-icon",
            cmds: [{type: "over", label: "manual"}],
        };
        const { features } = createUtoolsEnvironment([...managedFeatures, unmanagedFeature]);

        runtime.resetFeatures();

        expect([...features.values()]).toEqual([unmanagedFeature]);
    });

    it("skips writes when the requested keyword configuration is unchanged", () => {
        const existingFeature = buildLegacyDynamicFeatures(translate)[0];
        const { utools } = createUtoolsEnvironment([existingFeature]);

        runtime.setFeatures([{
            feature: allToolFeatures[0],
            cmds: existingFeature.cmds as string[],
        }]);

        expect(utools.setFeature).not.toHaveBeenCalled();
        expect(utools.removeFeature).not.toHaveBeenCalled();
    });

    it("rolls back the complete feature snapshot when setFeature returns false", () => {
        const existingFeature: DynamicFeature = {
            ...buildLegacyDynamicFeatures(translate)[0],
            platform: "darwin",
            icon: "old-icon",
            mainHide: true,
            mainPush: false,
            cmds: ["old-keyword"],
        };
        const unmanagedFeature: DynamicFeature = {
            code: "manual-unmanaged-feature",
            explain: "keep me",
            platform: "linux",
            cmds: ["manual"],
        };
        const { features, utools } = createUtoolsEnvironment([existingFeature, unmanagedFeature]);
        utools.setFeature
            .mockImplementationOnce((feature: DynamicFeature) => {
                features.set(feature.code, cloneFeature(feature));
            })
            .mockImplementationOnce(() => false);

        expect(() => runtime.setFeatures([
            {feature: allToolFeatures[0], cmds: ["changed-keyword"]},
            {feature: allToolFeatures[1], cmds: ["new-keyword"]},
        ])).toThrow("Failed to set uTools feature");

        expect([...features.values()]).toEqual([existingFeature, unmanagedFeature]);
    });

    it("rolls back removed entries when removeFeature returns false", () => {
        const existingFeatures = buildLegacyDynamicFeatures(translate).slice(0, 2);
        const unmanagedFeature: DynamicFeature = {
            code: "manual-unmanaged-feature",
            explain: "keep me",
            platform: "linux",
            cmds: ["manual"],
        };
        const { features, utools } = createUtoolsEnvironment([...existingFeatures, unmanagedFeature]);
        utools.removeFeature
            .mockImplementationOnce((code: string) => features.delete(code))
            .mockImplementationOnce(() => false);

        expect(() => runtime.resetFeatures()).toThrow("Failed to remove uTools feature");

        expect(sortFeatures([...features.values()]))
            .toEqual(sortFeatures([...existingFeatures, unmanagedFeature]));
    });

    it("treats a successful API response with an incomplete read-back as a failure", () => {
        const { features, utools } = createUtoolsEnvironment();
        utools.setFeature.mockImplementationOnce(() => undefined);

        expect(() => runtime.setFeatures([
            {feature: allToolFeatures[0], cmds: ["not-persisted"]},
        ])).toThrow("verification failed");

        expect(features.size).toBe(0);
    });

    it("reports a rollback failure instead of claiming success", () => {
        const existingFeatures = buildLegacyDynamicFeatures(translate).slice(0, 2);
        const { features, utools } = createUtoolsEnvironment(existingFeatures);
        utools.removeFeature
            .mockImplementationOnce((code: string) => features.delete(code))
            .mockImplementationOnce(() => false);
        utools.setFeature.mockImplementation(() => false);

        expect(() => runtime.resetFeatures()).toThrow("Failed to roll back");
        expect(features.size).toBe(1);
    });

    it.each(buildContentTriggerFeatures(translate))(
        "routes the opt-in content trigger $code to its tool feature",
        (contentFeature) => {
            const { utools } = createUtoolsEnvironment();
            const { initializer, storage } = createInitializer();
            runtime.initialize(initializer as any);
            const onPluginEnter = utools.onPluginEnter.mock.calls[0][0];
            const command = (contentFeature.cmds as {type: string}[])[0];
            const [, toolName, featureName] = contentFeature.code.split("-");

            onPluginEnter({
                code: contentFeature.code,
                type: command.type,
                payload: "content-payload",
            });

            expect(storage.setNoVersion)
                .toHaveBeenCalledWith("_temp_input_storage", "content-payload", 10);
            expect(initializer.push).toHaveBeenCalledWith(
                getTool(toolName as any).getFeature(featureName).getRouter(),
                expect.objectContaining({_t: expect.any(String)}),
            );
        },
    );
});
