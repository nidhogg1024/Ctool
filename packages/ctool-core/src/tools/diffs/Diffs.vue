<template>
    <HeightResize v-slot="{ height }">
        <Diff
            v-model:original="action.current.original"
            v-model:modified="action.current.modified"
            :lang="effectiveLanguage"
            :height="`${height}px`"
        >
            <Button
                v-if="supportsBeautify"
                size="small"
                :text="$t(`diffs_beautify_both`)"
                :disabled="!canBeautify"
                :loading="beautifyLoading"
                @click="beautify"
            />
            <Button size="small" :loading="aiSummarizeLoading" @click="aiSummarizeDiff()">✨ {{ $t('main_diffs_ai_summarize') }}</Button>
            <Select
                v-model="action.current.option.lang"
                size="small"
                :options="languageOptions"
                filterable
                filter-placeholder="Search language..."
            />
        </Diff>
    </HeightResize>
    <Modal v-model="showAiSummarize" :title="$t('main_diffs_ai_summarize_result')" width="70%">
        <Textarea :model-value="aiSummarizeText" :height="240" readonly />
    </Modal>
</template>
<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from "vue";
import { debounce } from "lodash";
import { initialize, useAction } from "@/store/action";
import { allLanguage } from "@/helper/code";
import Diff from "@/components/editor/Diff.vue";
import formatter from "@/tools/code/formatter";
import Modal from "@/components/Modal.vue";
import Textarea from "@/components/ui/Textarea.vue";
import useSetting from "@/store/setting";
import { chat} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";
import { buildDiffSummaryPrompt } from "./ai";
import { detectDiffFormat, isWellFormedXml, resolveDetectedLanguage } from "./formatDetector";
import type { DiffFormatDetection } from "./formatDetector";

const AUTO_LANGUAGE = "__auto__";
const LANGUAGE_MODE_VERSION = 1;
const AUTO_DETECT_DELAY = 250;

type DataType = {
    original: string;
    modified: string;
    option: {
        lang: string;
        languageModeVersion?: number;
    };
};
const storeSetting = useSetting();

const initialAction = await initialize<DataType>(
    {
        original: "",
        modified: "",
        option: {
            lang: AUTO_LANGUAGE,
        },
    },
    { paste: false },
);

// 旧版本的 Text 是默认值而不是用户选择；迁移后，新手动选择会连同版本号保存。
if (initialAction.items.option.languageModeVersion !== LANGUAGE_MODE_VERSION) {
    if (initialAction.items.option.lang === "Text") {
        initialAction.items.option.lang = AUTO_LANGUAGE;
    }
    initialAction.items.option.languageModeVersion = LANGUAGE_MODE_VERSION;
}

const action = useAction(initialAction);
let showAiSummarize = $ref(false);
let aiSummarizeText = $ref("");
let aiSummarizeLoading = $ref(false);
const beautifyLoading = ref(false);

const initialDetection = action.current.option.lang === AUTO_LANGUAGE
    ? detectDiffFormat(action.current.original, action.current.modified)
    : detectDiffFormat("", "");
const detection = ref<DiffFormatDetection>(initialDetection);
const detectedLanguage = ref(initialDetection.language);
const detectionMatchesContent = ref(initialDetection.confidence === "high");
let detectionVersion = 0;

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
});

const isAutoLanguage = computed(() => action.current.option.lang === AUTO_LANGUAGE);
const effectiveLanguage = computed(() => {
    return isAutoLanguage.value ? detectedLanguage.value : action.current.option.lang;
});
const hasContent = computed(() => {
    return action.current.original !== "" || action.current.modified !== "";
});
const supportsBeautify = computed(() => formatter.isEnable(effectiveLanguage.value, "beautify"));
const canBeautify = computed(() => {
    if (!supportsBeautify.value || !hasContent.value || beautifyLoading.value) {
        return false;
    }
    if (!isAutoLanguage.value) {
        return true;
    }
    return detectionMatchesContent.value && detection.value.language === effectiveLanguage.value;
});

const autoLanguageLabel = computed(() => {
    if (detection.value.conflict) {
        return $t("diffs_auto_language_conflict");
    }
    if (detectedLanguage.value === "Text") {
        return $t("diffs_auto_language");
    }
    return $t("diffs_auto_language_detected", [detectedLanguage.value]);
});
const languageOptions = computed(() => [
    {
        value: AUTO_LANGUAGE,
        label: autoLanguageLabel.value,
        description: $t("diffs_auto_language_description"),
    },
    ...allLanguage,
]);

const applyDetection = (result: DiffFormatDetection, version: number) => {
    if (version !== detectionVersion || action.current.option.lang !== AUTO_LANGUAGE) {
        return;
    }

    detection.value = result;
    detectionMatchesContent.value = result.confidence === "high";
    detectedLanguage.value = resolveDetectedLanguage(
        result,
        detectedLanguage.value,
        action.current.original,
        action.current.modified,
    );
};

const detectFormat = debounce((version: number, original: string, modified: string) => {
    applyDetection(detectDiffFormat(original, modified), version);
}, AUTO_DETECT_DELAY);

const queueDetection = (immediate = false) => {
    if (action.current.option.lang !== AUTO_LANGUAGE) {
        detectFormat.cancel();
        return;
    }

    const version = ++detectionVersion;
    const original = action.current.original;
    const modified = action.current.modified;
    detectionMatchesContent.value = false;

    if (immediate || (original.trim() === "" && modified.trim() === "")) {
        detectFormat.cancel();
        applyDetection(detectDiffFormat(original, modified), version);
        return;
    }

    detectFormat(version, original, modified);
};

const getErrorMessage = (error: unknown) => {
    return error instanceof Error ? error.message : String(error);
};

const beautifySide = async (side: "left" | "right", lang: string, code: string) => {
    if (code.trim() === "") {
        return code;
    }
    try {
        if (lang === "XML" && !isWellFormedXml(code)) {
            throw new Error($t("diffs_beautify_invalid_xml"));
        }
        return await formatter.simple(lang, "beautify", code) as string;
    } catch (error) {
        const key = side === "left" ? "diffs_beautify_left_error" : "diffs_beautify_right_error";
        throw new Error($t(key, [getErrorMessage(error)]));
    }
};

// 只有用户主动点击后才格式化；两侧都成功且内容未变化时才统一写回。
const beautify = async () => {
    if (!canBeautify.value) {
        return;
    }

    const selectedLanguage = action.current.option.lang;
    const lang = effectiveLanguage.value;
    const original = action.current.original;
    const modified = action.current.modified;
    beautifyLoading.value = true;

    try {
        // formatter 实例会复用内部状态，顺序执行可避免并发覆盖。
        const formattedOriginal = await beautifySide("left", lang, original);
        const formattedModified = await beautifySide("right", lang, modified);

        if (
            action.current.original !== original
            || action.current.modified !== modified
            || action.current.option.lang !== selectedLanguage
            || effectiveLanguage.value !== lang
        ) {
            Message.info($t("diffs_beautify_content_changed"));
            return;
        }

        action.current.original = formattedOriginal;
        action.current.modified = formattedModified;
    } catch (error) {
        Message.error(getErrorMessage(error));
    } finally {
        beautifyLoading.value = false;
    }
};

const aiSummarizeDiff = async () => {
    const original = action.current.original.trim();
    const modified = action.current.modified.trim();
    if (!original || !modified) {
        Message.error($t("main_diffs_ai_summarize_empty"));
        return;
    }
    const config = getAiConfig();
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"));
        return;
    }
    aiSummarizeLoading = true;
    try {
        const prompt = buildDiffSummaryPrompt({
            language: effectiveLanguage.value,
            original,
            modified,
        })
        const result = await chat([
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
        ], config);
        aiSummarizeText = result.content;
        showAiSummarize = true;
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]));
    } finally {
        aiSummarizeLoading = false;
    }
};

watch(
    () => [action.current.original, action.current.modified],
    () => {
        if (isAutoLanguage.value) {
            queueDetection();
        }
    },
);

watch(
    () => action.current.option.lang,
    lang => {
        detectionVersion += 1;
        detectFormat.cancel();
        detectionMatchesContent.value = false;
        if (lang === AUTO_LANGUAGE) {
            queueDetection(true);
        }
    },
);

// 数据保存
watch(
    () => action.current,
    () => {
        if (action.current.original === "" || action.current.modified === "") {
            return;
        }
        action.save();
    },
    { deep: true },
);

onUnmounted(() => {
    detectFormat.cancel();
});
</script>
<style></style>
