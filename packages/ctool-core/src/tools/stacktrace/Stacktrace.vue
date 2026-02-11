<template>
    <Align direction="vertical">
        <HeightResize v-slot="{ small, large }" :reduce="5">
            <Align direction="vertical">
                <Textarea v-model="action.current.input" :height="small" :placeholder="$t('stacktrace_input_placeholder')" />
                <div :style="{ height: `${large}px`, overflow: 'auto' }" v-if="parsed && parsed.frames.length > 0">
                    <!-- 元信息表格 -->
                    <div v-if="metaEntries.length > 0" class="st-card st-meta">
                        <table class="st-meta-table">
                            <tbody>
                                <tr v-for="([k, v]) in metaEntries" :key="k" @click="$copy(v)">
                                    <td class="st-meta-key">{{ k }}</td>
                                    <td class="st-meta-val" :title="v">{{ v }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- 堆栈标题 -->
                    <div class="st-title-bar">
                        <div class="st-title-left">
                            <span class="st-lang-badge">{{ parsed.language }}</span>
                            <span v-if="parsed.exception" class="st-exc-name">{{ parsed.exception }}</span>
                        </div>
                        <span class="st-count">{{ businessCount }} / {{ parsed.frames.length }} frames</span>
                    </div>
                    <div v-if="parsed.message" class="st-exc-msg" :title="parsed.message">{{ parsed.message }}</div>
                    <!-- 帧列表 -->
                    <div class="st-card st-frame-list">
                        <template v-for="(group, gi) in frameGroups" :key="gi">
                            <!-- 业务帧 -->
                            <template v-if="group.type === 'business'">
                                <div
                                    v-for="(item) in group.frames"
                                    :key="item.idx"
                                    class="st-row st-row-app"
                                    @click="$copy(`${item.frame.file}:${item.frame.line}`)"
                                    :title="`${item.frame.file}:${item.frame.line}`"
                                >
                                    <div class="st-row-body">
                                        <span class="st-row-file">{{ item.frame.file }}</span>
                                        <span class="st-row-sep">{{ $t('stacktrace_at') }}</span>
                                        <span class="st-row-fn">{{ splitMethod(item.frame.method).fn }}</span>
                                        <span class="st-row-sep">{{ $t('stacktrace_line') }}</span>
                                        <span class="st-row-line">{{ item.frame.line }}</span>
                                    </div>
                                    <span class="st-badge-app">In App</span>
                                </div>
                            </template>
                            <!-- 框架帧组 -->
                            <template v-else>
                                <div
                                    v-if="!group.expanded"
                                    class="st-collapse-bar"
                                    @click="group.expanded = true"
                                >
                                    <span class="st-collapse-text">{{ $t('stacktrace_show_n_frames', { n: group.frames.length }) }}</span>
                                </div>
                                <template v-else>
                                    <div class="st-collapse-bar" @click="group.expanded = false">
                                        <span class="st-collapse-text">{{ $t('stacktrace_hide_frames') }}</span>
                                    </div>
                                    <div
                                        v-for="(item) in group.frames"
                                        :key="item.idx"
                                        class="st-row st-row-fw"
                                        @click="$copy(`${item.frame.file}:${item.frame.line}`)"
                                        :title="`${item.frame.file}:${item.frame.line}`"
                                    >
                                        <div class="st-row-body">
                                            <span class="st-row-file">{{ item.frame.file }}</span>
                                            <span class="st-row-sep">{{ $t('stacktrace_at') }}</span>
                                            <span class="st-row-fn">{{ splitMethod(item.frame.method).fn }}</span>
                                            <span class="st-row-sep">{{ $t('stacktrace_line') }}</span>
                                            <span class="st-row-line">{{ item.frame.line }}</span>
                                        </div>
                                    </div>
                                </template>
                            </template>
                        </template>
                    </div>
                </div>
            </Align>
        </HeightResize>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { reactive, watch } from "vue";
import { parseStackTrace, preprocessInput, type ParsedStack, type StackFrame, type LogMeta } from "./parser";

interface IndexedFrame { idx: number; frame: StackFrame }
interface FrameGroup { type: 'business' | 'framework'; frames: IndexedFrame[]; expanded: boolean }

const action = useAction(await initialize({ input: "" }));

let parsed = $ref<ParsedStack | null>(null);
let meta = $ref<LogMeta | undefined>(undefined);
let frameGroups = $ref<FrameGroup[]>([]);

const metaEntries = $computed(() => meta ? Object.entries(meta) : []);
const businessCount = $computed(() => parsed ? parsed.frames.filter(f => isBusinessCode(f)).length : 0);

const isBusinessCode = (frame: StackFrame): boolean => {
    const target = `${frame.file} ${frame.method}`.toLowerCase();
    const fw = [
        "java.lang", "java.util", "sun.reflect", "org.springframework", "javax.", "jdk.",
        "native method", "java.net", "java.io",
        "node_modules", "node:internal", "webpack", "vite", "react-dom", "zone.js", "next/dist",
        "site-packages", "lib/python", "django/", "flask/", "importlib",
        "runtime/", "net/http", "google.golang.org/grpc",
        "github.com/newrelic", "github.com/getsentry", "/go/pkg/mod/",
        "system.", "microsoft.", "gems/", "ruby/", "vendor/",
        "<native>", "<anonymous>",
    ];
    return !fw.some(kw => target.includes(kw));
};

const buildGroups = (frames: StackFrame[]): FrameGroup[] => {
    const groups: FrameGroup[] = [];
    let currentType: 'business' | 'framework' | null = null;
    frames.forEach((frame, idx) => {
        const type: 'business' | 'framework' = isBusinessCode(frame) ? 'business' : 'framework';
        if (type !== currentType) {
            groups.push(reactive<FrameGroup>({ type, frames: [], expanded: false }));
            currentType = type;
        }
        groups[groups.length - 1].frames.push({ idx: idx + 1, frame });
    });
    return groups;
};

const splitMethod = (method: string): { pkg: string; fn: string } => {
    if (!method || method === "-") return { pkg: "", fn: method || "-" };
    const i = Math.max(method.lastIndexOf('.'), method.lastIndexOf('::'));
    if (i > 0 && i < method.length - 1) return { pkg: method.substring(0, i + 1), fn: method.substring(i + 1) };
    return { pkg: "", fn: method };
};

watch(() => action.current.input, (val) => {
    const trimmed = val.trim();
    if (!trimmed) { parsed = null; meta = undefined; frameGroups = []; return; }
    const result = preprocessInput(trimmed);
    meta = result.meta;
    parsed = parseStackTrace(result.stackText);
    if (parsed.frames.length > 0) {
        frameGroups = buildGroups(parsed.frames);
        action.save();
    }
}, { immediate: true });
</script>

<style scoped>
/* ===== 通用卡片 ===== */
.st-card {
    border: 1px solid var(--ctool-border-color);
    border-radius: 10px;
    overflow: hidden;
}

/* ===== 元信息 ===== */
.st-meta {
    margin-bottom: 10px;
}
.st-meta-table {
    width: 100%;
    border-collapse: collapse;
}
.st-meta-table tr {
    cursor: pointer;
    transition: background 0.15s;
}
.st-meta-table tr:not(:last-child) {
    border-bottom: 1px solid var(--ctool-border-color);
}
.st-meta-table tr:hover {
    background: var(--primary-focus);
}
.st-meta-key {
    padding: 7px 14px;
    font-size: .75rem;
    color: var(--ctool-placeholder-text-color);
    white-space: nowrap;
    width: 1%;
}
.st-meta-val {
    padding: 7px 14px;
    font-size: .8125rem;
    color: var(--ctool-text-color);
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ===== 标题区 ===== */
.st-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 2px;
}
.st-title-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.st-lang-badge {
    display: inline-block;
    padding: 2px 12px;
    border-radius: 20px;
    font-size: .75rem;
    font-weight: 600;
    color: var(--ctool-primary);
    background: var(--primary-focus);
}
.st-exc-name {
    font-size: .875rem;
    font-weight: 700;
    color: var(--ctool-text-color);
}
.st-count {
    font-size: .75rem;
    color: var(--ctool-placeholder-text-color);
}
.st-exc-msg {
    padding: 0 2px 8px;
    font-size: .8125rem;
    color: var(--ctool-placeholder-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ===== 帧列表 ===== */
.st-frame-list {
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace;
    font-size: .8125rem;
}

/* --- 单行帧 --- */
.st-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    gap: 12px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
}
.st-row:not(:last-child) {
    border-bottom: 1px solid var(--ctool-border-color);
}

/* 业务帧 */
.st-row-app {
    background: var(--ctool-bg-color);
    color: var(--ctool-text-color);
}
.st-row-app:hover {
    background: var(--primary-focus);
}

/* 框架帧 */
.st-row-fw {
    background: var(--ctool-block-bg-color);
    color: var(--ctool-text-color);
    font-size: .75rem;
}
.st-row-fw:hover {
    background: var(--primary-focus);
}

/* 帧主体 */
.st-row-body {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
}
.st-row-file {
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.st-row-app .st-row-file {
    color: var(--ctool-text-color);
    opacity: 0.88;
}
.st-row-fw .st-row-file {
    color: var(--ctool-text-color);
    opacity: 0.5;
}
.st-row-sep {
    flex-shrink: 0;
    font-size: .6875rem;
    opacity: 0.55;
}
.st-row-app .st-row-sep {
    color: var(--ctool-text-color);
}
.st-row-fw .st-row-sep {
    color: var(--ctool-text-color);
}
.st-row-fn {
    flex-shrink: 0;
    font-weight: 700;
    white-space: nowrap;
    color: var(--ctool-text-color);
}
.st-row-fw .st-row-fn {
    font-weight: 500;
    opacity: 0.6;
}
.st-row-line {
    flex-shrink: 0;
    white-space: nowrap;
}
.st-row-app .st-row-line {
    color: var(--ctool-text-color);
    opacity: 0.8;
}
.st-row-fw .st-row-line {
    color: var(--ctool-text-color);
    opacity: 0.5;
}

/* In App 标记 */
.st-badge-app {
    flex-shrink: 0;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: .6875rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    color: var(--ctool-primary);
    background: var(--primary-focus);
    white-space: nowrap;
}

/* --- 折叠条 --- */
.st-collapse-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    cursor: pointer;
    user-select: none;
    background: var(--ctool-block-bg-color);
    border-bottom: 1px solid var(--ctool-border-color);
    transition: background 0.15s;
}
.st-collapse-bar:hover {
    background: var(--primary-focus);
}
.st-collapse-text {
    font-size: .75rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--ctool-primary);
    opacity: 0.85;
    transition: opacity 0.15s;
}
.st-collapse-bar:hover .st-collapse-text {
    opacity: 1;
}
</style>
