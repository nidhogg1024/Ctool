<template>
    <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- 表达式编辑器 -->
        <Align direction="vertical" class="ctool-json-transform-header" :bottom="'default'">
            <Display position="right-center">
                <Input
                    v-model="option.expression"
                    :placeholder="$t('json_transform_placeholder')"
                    :label="$t('json_transform')"
                />
                <template #extra>
                    <Align>
                        <Dropdown
                            :size="'small'"
                            :options="presetExpressions"
                            :placeholder="$t('json_transform_preset')"
                            @select="value => (option.expression = value)"
                        />
                    </Align>
                </template>
            </Display>
        </Align>
        <!-- 结果输出 -->
        <HeightResize @resize="resize" :father-height="height" :append="['.ctool-json-transform-header']">
            <Editor
                :model-value="output"
                :placeholder="`${$t('json_transform')} ${$t('main_ui_output')}`"
                lang="json"
                :height="`${editorHeight}px`"
            />
        </HeightResize>
    </div>
</template>

<script lang="ts" setup>
import {PropType, watch} from "vue";
import {isObject} from "lodash";
import _ from "lodash";
import formatter from "../code/formatter";
import Serialize from "@/helper/serialize";

export type TransformOptionType = {
    expression: string;
}

const props = defineProps({
    modelValue: {
        type: Object as PropType<TransformOptionType>,
        default: () => {
            return {
                expression: "",
            }
        }
    },
    json: {
        type: Object as PropType<Serialize>,
        default: () => {
            return Serialize.empty()
        }
    },
    height: {
        type: Number,
        default: 0
    },
})
const emit = defineEmits<{ (e: 'update:modelValue', modelValue: TransformOptionType): void, (e: 'success'): void }>()

const option: TransformOptionType = $computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// 预设常用表达式
const presetExpressions = [
    {label: "Object.keys(data)", value: "Object.keys(data)"},
    {label: "Object.values(data)", value: "Object.values(data)"},
    {label: "_.map(data, 'key')", value: "_.map(data, 'key')"},
    {label: "_.filter(data, {key: 'value'})", value: "_.filter(data, {key: 'value'})"},
    {label: "_.groupBy(data, 'key')", value: "_.groupBy(data, 'key')"},
    {label: "_.sortBy(data, 'key')", value: "_.sortBy(data, 'key')"},
    {label: "_.uniqBy(data, 'key')", value: "_.uniqBy(data, 'key')"},
    {label: "_.pick(data, ['key1', 'key2'])", value: "_.pick(data, ['key1', 'key2'])"},
    {label: "_.omit(data, ['key'])", value: "_.omit(data, ['key'])"},
    {label: "data.length", value: "data.length"},
]

/**
 * 执行用户表达式
 * data: 输入的 JSON 数据
 * _: lodash 工具库
 */
const executeTransform = (data: any, expression: string): any => {
    // 使用 new Function 在隔离作用域中执行，避免污染全局
    const fn = new Function('data', '_', `"use strict"; return (${expression})`)
    return fn(data, _)
}

let output = $ref("")

// debounce 定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => {
    return {
        json: props.json,
        expression: option.expression,
    }
}, ({json, expression}) => {
    // 清除上一次的定时器
    if (debounceTimer) {
        clearTimeout(debounceTimer)
    }

    // 空输入直接清空
    if (json.isEmpty() || !expression || expression.trim() === "") {
        output = ""
        return
    }
    if (json.isError()) {
        output = json.error()
        return
    }

    // debounce 300ms，避免输入时频繁执行
    debounceTimer = setTimeout(async () => {
        try {
            const data = json.content()
            const result = executeTransform(data, expression.trim())
            if (result === undefined || result === null) {
                output = String(result)
            } else if (isObject(result)) {
                output = await formatter.simple('json', 'beautify', result)
            } else {
                output = String(result)
            }
            emit('success')
        } catch (e) {
            output = $error(e)
        }
    }, 300)
}, {immediate: true, deep: true})

let editorHeight = $ref(100)
const resize = (height) => {
    editorHeight = height
}
</script>
