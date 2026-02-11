<template>
    <HeightResize v-slot="{ height }" :append="['.ctool-page-option']">
        <div v-row="'1-1'" :style="{ height: `${height}px` }">
            <Editor v-model="action.current.input" :lang="editorLang(action.current.sourceFormat)" :height="`${height}px`" :placeholder="$t('configConvert_source')" />
            <Editor :model-value="output" :lang="editorLang(action.current.targetFormat)" :height="`${height}px`" :placeholder="$t('configConvert_target')" />
        </div>
    </HeightResize>
    <Align horizontal="center" class="ctool-page-option">
        <Select v-model="action.current.sourceFormat" :options="formatOptions" :label="$t('configConvert_source')" />
        <span style="font-size: 1.2rem; color: var(--ctool-placeholder-text-color);">→</span>
        <Select v-model="action.current.targetFormat" :options="formatOptions" :label="$t('configConvert_target')" />
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import yaml from "js-yaml";
import TOML from "@iarna/toml";

type Format = "json" | "yaml" | "toml" | "properties";

const formatOptions = [
    { value: "json", label: "JSON" },
    { value: "yaml", label: "YAML" },
    { value: "toml", label: "TOML" },
    { value: "properties", label: "Properties" },
];

const editorLang = (fmt: string) => {
    const map: Record<string, string> = { json: "json", yaml: "yaml", toml: "toml", properties: "properties" };
    return map[fmt] || "text";
};

const action = useAction(await initialize({
    input: "",
    sourceFormat: "json" as Format,
    targetFormat: "yaml" as Format,
}));

// Properties 解析/序列化
const parseProperties = (text: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
        const idx = trimmed.search(/[=:]/);
        if (idx < 0) continue;
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        result[key] = val;
    }
    return result;
};

const stringifyProperties = (obj: Record<string, unknown>, prefix = ""): string => {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
            lines.push(stringifyProperties(val as Record<string, unknown>, fullKey));
        } else {
            lines.push(`${fullKey}=${val}`);
        }
    }
    return lines.join("\n");
};

// 解析输入
const parse = (text: string, fmt: Format): unknown => {
    switch (fmt) {
        case "json": return JSON.parse(text);
        case "yaml": return yaml.load(text);
        case "toml": return TOML.parse(text);
        case "properties": return parseProperties(text);
    }
};

// 序列化输出
const stringify = (data: unknown, fmt: Format): string => {
    switch (fmt) {
        case "json": return JSON.stringify(data, null, 2);
        case "yaml": return yaml.dump(data, { indent: 2, lineWidth: -1 });
        case "toml": return TOML.stringify(data as any);
        case "properties": return stringifyProperties(data as Record<string, unknown>);
    }
};

let output = $ref("");

watch(() => ({
    input: action.current.input,
    source: action.current.sourceFormat,
    target: action.current.targetFormat,
}), ({ input, source, target }) => {
    output = "";
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
        const data = parse(trimmed, source as Format);
        output = stringify(data, target as Format);
        action.save();
    } catch (e) {
        output = $error(e);
    }
}, { immediate: true, deep: true });
</script>
