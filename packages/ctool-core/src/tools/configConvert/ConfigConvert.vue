<template>
    <Align direction="vertical">
        <Align horizontal="center" class="ctool-page-option">
            <Select v-model="action.current.sourceFormat" :options="sourceFormatOptions" :label="$t('configConvert_source')" />
            <Button text="⇄" @click="swap" />
            <Select v-model="action.current.targetFormat" :options="targetFormatOptions" :label="$t('configConvert_target')" />
            <Button :loading="aiDetectLoading" @click="aiDetectSourceFormat()">✨ {{ $t('main_configConvert_ai_detect_source') }}</Button>
        </Align>
        <HeightResize v-slot="{ height }" :reduce="5" :append="['.ctool-page-option']">
            <div v-row="'1-1'" :style="{ height: `${height}px` }">
                <Editor v-model="action.current.input" :lang="editorLang(action.current.sourceFormat)" :height="`${height}px`" :placeholder="$t('configConvert_source')" />
                <Editor :model-value="output" :lang="editorLang(action.current.targetFormat)" :height="`${height}px`" :placeholder="$t('configConvert_target')" />
            </div>
        </HeightResize>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import Serialize from "@/helper/serialize";
import { getDisplayName } from "@/helper/code";
import formatter from "@/tools/code/formatter";
import useTransfer from "@/store/transfer";
import useSetting from "@/store/setting";
import { chat, extractCode} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";
import { normalizeDetectedFormat } from "./ai";

// 支持的全部格式（Serialize 体系中可双向转换的格式）
const sourceFormats = [
    "text",
    "json", "yaml", "toml", "xml", "csv", "properties",
    "html_table", "http_query_string", "php_array", "php_serialize",
] as const;
const targetFormats = [
    "text",
    "json", "yaml", "toml", "xml", "csv", "properties",
    "html_table", "http_query_string", "php_array", "php_serialize",
] as const;
type SourceFormat = typeof sourceFormats[number];
type TargetFormat = typeof targetFormats[number];

const sourceFormatOptions = sourceFormats.map(f => ({ value: f, label: getDisplayName(f) }));
const targetFormatOptions = targetFormats.map(f => ({ value: f, label: getDisplayName(f) }));

// 编辑器语言映射
const editorLang = (fmt: string) => {
    const map: Record<string, string> = {
        text: "text", json: "json", yaml: "yaml", toml: "toml", xml: "xml",
        csv: "csv", properties: "properties", html_table: "html_table",
        http_query_string: "http_query_string", php_array: "php_array",
        php_serialize: "php_serialize",
    };
    return map[fmt] || "text";
};

const transfer = useTransfer();
const storeSetting = useSetting();

const action = useAction(await initialize({
    input: "",
    sourceFormat: "json" as SourceFormat,
    targetFormat: "yaml" as TargetFormat,
}));

// 接收来自其他工具（如 JSON 工具）的传递数据
if (transfer.hasData()) {
    const transferred = transfer.consume();
    action.current.input = transferred.data;
    action.current.sourceFormat = transferred.sourceFormat as SourceFormat;
}

// 解析输入为 Serialize 对象
const parse = (text: string, fmt: SourceFormat): Serialize => {
    switch (fmt) {
        case "text": return Serialize.formText(text);
        case "json": return Serialize.formJson(text);
        case "yaml": return Serialize.formYaml(text);
        case "toml": return Serialize.formToml(text);
        case "properties": return Serialize.formProperties(text);
        case "csv": return Serialize.formCsv(text);
        case "xml": return Serialize.formXml(text);
        case "html_table": return Serialize.formTable(text);
        case "http_query_string": return Serialize.formQueryString(text);
        case "php_array": return Serialize.formPhpArray(text);
        case "php_serialize": return Serialize.formPhpSerialize(text);
    }
};

// CSV/HTML Table 需要数组数据，如果源是对象则包装成数组
const ensureArray = (data: Serialize): Serialize => {
    const content = data.content();
    if (!Array.isArray(content)) {
        return Serialize.formObject([content]);
    }
    return data;
};

// 将 Serialize 对象序列化为目标格式
const stringify = (data: Serialize, fmt: TargetFormat): string => {
    switch (fmt) {
        case "text": return ensureArray(data).toText();
        case "json": return data.toJson();
        case "yaml": return data.toYaml();
        case "toml": return data.toToml();
        case "properties": return data.toProperties();
        case "csv": return ensureArray(data).toCsv();
        case "xml": return data.toXml();
        case "html_table": return ensureArray(data).toTable();
        case "http_query_string": return data.toQueryString();
        case "php_array": return data.toPhpArray();
        case "php_serialize": return data.toPhpSerialize();
    }
};

let output = $ref("");
let aiDetectLoading = $ref(false);

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
});

const aiDetectSourceFormat = async () => {
    const input = action.current.input.trim();
    if (!input) {
        Message.error($t("main_configConvert_ai_detect_empty"));
        return;
    }
    const config = getAiConfig();
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"));
        return;
    }
    aiDetectLoading = true;
    try {
        const result = await chat([
            {
                role: "system",
                content: `你是一个配置格式识别助手。请从以下候选中识别用户输入最可能的来源格式，只输出一个格式 ID，不要解释：${sourceFormats.join(", ")}。`,
            },
            { role: "user", content: input },
        ], config);
        const detected = normalizeDetectedFormat(extractCode(result.content), sourceFormats);
        if (!detected) {
            Message.error($t("main_configConvert_ai_detect_invalid"));
            return;
        }
        action.current.sourceFormat = detected;
        Message.success($t("main_configConvert_ai_detect_success", [getDisplayName(detected)]));
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]));
    } finally {
        aiDetectLoading = false;
    }
};

// 交换源格式和目标格式，同时把输出结果作为新的输入
const swap = () => {
    const prevOutput = output;
    const prevSource = action.current.sourceFormat;
    action.current.sourceFormat = action.current.targetFormat;
    action.current.targetFormat = prevSource;
    if (prevOutput && !prevOutput.startsWith("Error")) {
        action.current.input = prevOutput;
    }
};

// 监听输入和格式变化，实时转换
watch(() => ({
    input: action.current.input,
    source: action.current.sourceFormat,
    target: action.current.targetFormat,
}), async ({ input, source, target }) => {
    output = "";
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
        const data = parse(trimmed, source as SourceFormat);
        if (data.isError()) {
            output = data.error();
            return;
        }
        if (data.isEmpty()) return;
        const raw = stringify(data, target as TargetFormat);
        // 美化输出
        output = await formatter.simple(target, 'beautify', raw);
        action.save();
    } catch (e) {
        output = $error(e);
    }
}, { immediate: true, deep: true });
</script>
