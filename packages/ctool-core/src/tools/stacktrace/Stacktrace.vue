<template>
    <Align direction="vertical">
        <HeightResize v-slot="{ small, large }" :reduce="5">
            <Align direction="vertical">
                <Textarea v-model="action.current.input" :height="small" :placeholder="$t('stacktrace_input_placeholder')" />
                <div :style="{ height: `${large}px`, overflow: 'auto' }" v-if="parsed && parsed.frames.length > 0">
                    <Card padding="0">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr;">
                            <Item :title="$t('stacktrace_language')" :value="parsed.language" />
                            <Item :title="$t('stacktrace_exception')" :value="parsed.exception || '-'" />
                            <Item :title="$t('stacktrace_message')" :value="parsed.message || '-'" />
                        </div>
                    </Card>
                    <Card :title="`${$t('stacktrace_frames')} (${parsed.frames.length})`" padding="0" style="margin-top: 5px;">
                        <div v-for="(frame, i) in parsed.frames" :key="i" class="stacktrace-frame" :class="{ 'stacktrace-frame-highlight': isBusinessCode(frame) }">
                            <span class="stacktrace-frame-index">{{ i + 1 }}</span>
                            <span class="stacktrace-frame-method">{{ frame.method }}</span>
                            <span class="stacktrace-frame-location">{{ frame.file }}:{{ frame.line }}</span>
                        </div>
                    </Card>
                </div>
            </Align>
        </HeightResize>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import { parseStackTrace, type ParsedStack, type StackFrame } from "./parser";
import Item from "../ipcalc/Item.vue";

const action = useAction(await initialize({
    input: "",
}));

let parsed = $ref<ParsedStack | null>(null);

// 判断是否为业务代码（非框架代码）：简单启发式
const isBusinessCode = (frame: StackFrame): boolean => {
    const file = frame.file.toLowerCase();
    // 常见框架/库路径关键词
    const frameworkKeywords = [
        "node_modules", "vendor", "java.lang", "java.util", "sun.reflect",
        "org.springframework", "javax.", "jdk.", "runtime", "internal",
        "site-packages", "lib/python", "goroutine", "<native>", "Native Method",
    ];
    return !frameworkKeywords.some(kw => file.includes(kw.toLowerCase()));
};

watch(() => action.current.input, (val) => {
    const trimmed = val.trim();
    if (!trimmed) { parsed = null; return; }
    parsed = parseStackTrace(trimmed);
    if (parsed.frames.length > 0) action.save();
}, { immediate: true });
</script>

<style scoped>
.stacktrace-frame {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 16px;
    font-size: .8125rem;
    font-family: monospace;
    border-bottom: 1px solid var(--ctool-border-color);
    color: var(--ctool-placeholder-text-color);
}
.stacktrace-frame:last-child {
    border-bottom: none;
}
.stacktrace-frame-highlight {
    color: var(--ctool-text-color);
    background-color: var(--primary-focus);
}
.stacktrace-frame-index {
    min-width: 24px;
    text-align: right;
    opacity: 0.5;
}
.stacktrace-frame-method {
    font-weight: bold;
    flex-shrink: 0;
}
.stacktrace-frame-location {
    margin-left: auto;
    opacity: 0.7;
}
</style>
