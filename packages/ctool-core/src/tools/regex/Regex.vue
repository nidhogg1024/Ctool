<template>
    <div class="ctool-page-option" style="margin-bottom: 5px" v-row="`1-1`">
        <Display>
            <Textarea :height="80" v-model="action.current.input" :placeholder="$t('regex_expression')" />
            <template #extra>
                <Align>
                    <Dropdown
                        :size="'small'"
                        :options="getCommonExpression()"
                        :placeholder="$t('regex_common')"
                        @select="value => (action.current.input += value)"
                    />
                    <Button
                        :size="'small'"
                        :type="'primary'"
                        @click="showReference = !showReference"
                        :text="$t(`main_ui_reference`)"
                    />
                    <span>|</span>
                    <Button :size="'small'" :loading="aiLoading" @click="showAiGenerate = true">✨ {{ $t('main_regex_ai_generate') }}</Button>
                    <Button :size="'small'" :loading="aiExplainLoading" @click="aiExplainRegex()">✨ {{ $t('main_regex_ai_explain') }}</Button>
                </Align>
            </template>
        </Display>
        <Display>
            <Textarea
                :disabled="action.current.is_delete"
                :height="80"
                v-model="action.current.replace"
                :placeholder="$t('regex_replace_content_hint')"
            />
            <template #extra>
                <Align>
                    <Bool border :size="'small'" v-model="action.current.is_delete" :label="$t('regex_delete')" />
                    <span style="font-size: 12px; color: var(--ctool-info-color);">{{ $t('regex_replace_mode_tip') }}</span>
                </Align>
            </template>
        </Display>
    </div>
    <HeightResize v-slot="{ height }" :append="['.ctool-page-option']" v-row="`1-1`">
        <Display>
            <Editor :height="height" v-model="action.current.content" :placeholder="$t('regex_input')" />
            <template #extra>
                <Align>
                    <Bool border :size="'small'" v-model="action.current.is_global" :label="$t('regex_global')" />
                    <Bool
                        border
                        :size="'small'"
                        v-model="action.current.is_ignore_case"
                        :label="$t('regex_ignore_case')"
                    />
                    <Bool border :size="'small'" v-model="action.current.is_multiline" :label="$t('regex_multiline')" />
                    <Bool border :size="'small'" v-model="action.current.is_dotall" :label="$t('regex_dotall')" />
                </Align>
            </template>
        </Display>
        <Editor :height="height" :model-value="output" :placeholder="$t('main_ui_output')" />
    </HeightResize>
    <ExtendPage v-model="showReference">
        <Reference />
    </ExtendPage>
    <!-- AI 生成正则弹窗 -->
    <Modal v-model="showAiGenerate" :title="$t('main_regex_ai_generate')" footer-type="normal" :loading="aiLoading" @ok="aiGenerateRegex()">
        <Textarea v-model="aiPromptText" :height="100" :placeholder="$t('main_regex_ai_generate_placeholder')" />
    </Modal>
    <!-- AI 解释结果弹窗 -->
    <Modal v-model="showAiExplain" :title="$t('main_regex_ai_explain_result')" width="70%">
        <Textarea :model-value="aiExplainText" :height="200" />
    </Modal>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { getCommonExpression } from "@/tools/regex/util";
import { watch } from "vue";
import Reference from "./Reference.vue";
import Modal from "@/components/Modal.vue";
import useSetting from "@/store/setting";
import { chat, extractCode } from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const storeSetting = useSetting();

const action = useAction(
    await initialize(
        {
            input: "[\\dheo]",
            content: new Date().getFullYear() + " hello WORLD 你好世界",
            replace: "",
            is_global: true,
            is_ignore_case: true,
            is_multiline: false,
            is_dotall: false,
            is_delete: false,
        },
        { paste: false },
    ),
);

let output = $ref("");
const showReference = $ref(false);

// AI 相关状态
let showAiGenerate = $ref(false);
let showAiExplain = $ref(false);
let aiPromptText = $ref("");
let aiExplainText = $ref("");
let aiLoading = $ref(false);
let aiExplainLoading = $ref(false);

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
});

const aiGenerateRegex = async () => {
    if (!aiPromptText.trim()) {
        Message.error($t("main_regex_ai_generate_empty"));
        return;
    }
    const config = getAiConfig();
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"));
        return;
    }
    aiLoading = true;
    try {
        const result = await chat([
            {
                role: "system",
                content: "你是一个正则表达式专家。根据用户的自然语言描述，生成对应的 JavaScript 正则表达式。\n\n规则：\n1. 只输出正则表达式本体（不要包含 / 定界符和 flags）\n2. 不要输出任何解释或 Markdown 标记\n3. 正则必须兼容 JavaScript RegExp 语法",
            },
            { role: "user", content: aiPromptText.trim() },
        ], config);
        action.current.input = extractCode(result.content);
        showAiGenerate = false;
        aiPromptText = "";
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]));
    } finally {
        aiLoading = false;
    }
};

const aiExplainRegex = async () => {
    if (!action.current.input.trim()) {
        Message.error($t("main_regex_ai_explain_empty"));
        return;
    }
    const config = getAiConfig();
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"));
        return;
    }
    aiExplainLoading = true;
    try {
        const result = await chat([
            {
                role: "system",
                content: "你是一个正则表达式专家。用户会给你一段正则表达式，请用简洁的中文解释它的含义。\n\n规则：\n1. 逐段解释正则的各个部分\n2. 最后给出整体的自然语言描述\n3. 如果有常见的匹配/不匹配示例，简要列出",
            },
            { role: "user", content: action.current.input.trim() },
        ], config);
        aiExplainText = result.content;
        showAiExplain = true;
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]));
    } finally {
        aiExplainLoading = false;
    }
};
watch(
    () => action.current,
    current => {
        output = "";
        try {
            if (!current.input || !current.content) {
                return output;
            }
            const replace =
                !current.is_delete && current.replace === "" ? false : current.is_delete ? "" : current.replace;

            const flags = (current.is_ignore_case ? "i" : "") + (current.is_global ? "g" : "") + (current.is_multiline ? "m" : "") + (current.is_dotall ? "s" : "");
            const reg = new RegExp(current.input, flags);
            if (replace !== false) {
                output = current.content.replace(reg, replace);
            } else {
                const arr = current.content.match(reg);
                let string = "";
                if (arr) {
                    string += `${$t("regex_output_count", [arr.length])}`;
                    for (let i = 0; i < arr.length; i++) {
                        string += `\n${arr[i]}`;
                    }
                } else {
                    string = $t("regex_output_empty");
                }
                output = string;
            }
            action.save();
        } catch (e) {
            output = $error(e);
        }
    },
    { immediate: true, deep: true },
);
</script>
