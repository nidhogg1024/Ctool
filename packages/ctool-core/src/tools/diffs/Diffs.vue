<template>
    <HeightResize v-slot="{ height }">
        <Diff
            ref="diffRef"
            v-model:original="action.current.original"
            v-model:modified="action.current.modified"
            :lang="action.current.option.lang"
            :height="`${height}px`"
        >
            <Button v-if="canBeautify" size="small" :text="$t(`code_beautify`)" @click="beautify" />
            <Button size="small" :loading="aiSummarizeLoading" @click="aiSummarizeDiff()">✨ {{ $t('main_diffs_ai_summarize') }}</Button>
            <Select size="small" v-model="action.current.option.lang" :options="allLanguage" filterable filter-placeholder="Search language..." />
        </Diff>
    </HeightResize>
    <Modal v-model="showAiSummarize" :title="$t('main_diffs_ai_summarize_result')" width="70%">
        <Textarea :model-value="aiSummarizeText" :height="240" readonly />
    </Modal>
</template>
<script lang="ts" setup>
import { watch, ref, computed } from "vue";
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

type DataType = {
    original: string;
    modified: string;
    option: {
        lang: string;
    };
};
const diffRef = ref<InstanceType<typeof Diff> | null>(null);
const storeSetting = useSetting();

const action = useAction(
    await initialize<DataType>(
        {
            original: "",
            modified: "",
            option: {
                lang: "Text",
            },
        },
        { paste: false },
    ),
);
let showAiSummarize = $ref(false);
let aiSummarizeText = $ref("");
let aiSummarizeLoading = $ref(false);

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
});

// 当前语言是否支持格式化
const canBeautify = computed(() => formatter.isEnable(action.current.option.lang, "beautify"));

// 一键格式化左右两侧代码
const beautify = async () => {
    await diffRef.value?.beautifyBoth(async (lang: string, code: string) => {
        return await formatter.simple(lang, "beautify", code) as string;
    });
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
            language: action.current.option.lang,
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
</script>
<style></style>
