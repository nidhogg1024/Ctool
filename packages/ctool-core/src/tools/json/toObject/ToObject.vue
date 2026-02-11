<template>
    <div v-row="current.lang ? '1-250px' : '1'" :style="{ height: `${height}px` }">
        <!-- 生成的代码 -->
        <Editor :model-value="output" :height="`${height}px`" :lang="current.lang" />
        <!-- 选项面板（右侧，语言选中后才渲染） -->
        <Card v-if="current.lang" :height="height" :title="getDisplayName(current.lang)" padding="5px 10px">
            <Align :direction="'vertical'">
                <div v-for="item in optionDefine">
                    <template v-if="item.type === 'boolean'">
                        <Bool v-model="current.option[current.lang][item.name]" :label="translateOption(item.name, item.description)" />
                    </template>
                    <template v-else>
                        <div style="font-size: 14px">{{ translateOption(item.name, item.description) }}</div>
                        <Select
                            v-if="item.type === 'select'"
                            :center="false"
                            width="100%"
                            v-model="current.option[current.lang][item.name]"
                            :options="item.value"
                        />
                        <Input v-else v-model="current.option[current.lang][item.name]" />
                    </template>
                </div>
            </Align>
        </Card>
    </div>
</template>

<script lang="ts" setup>
import { PropType, watch } from "vue"
import Serialize from "@/helper/serialize"
import { getDisplayName } from "@/helper/code";
import { transform, Option } from "./index";

const props = defineProps({
    modelValue: {
        type: Object as PropType<Option>,
        required: true
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

const emit = defineEmits<{ (e: 'update:modelValue', modelValue: Option): void, (e: 'success'): void }>()

const current: Option = $computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

let output = $ref("")

const optionDefine = $computed(() => {
    return current.define()
})

// 选项名中文翻译（覆盖常见的 quicktype 选项，未匹配的显示英文原文）
const optionTranslations: Record<string, string> = {
    // 通用推断选项（所有语言共享）
    'inferMaps': '检测 Map 类型',
    'inferEnums': '检测枚举类型',
    'inferDateTimes': '检测日期和时间',
    'inferUuids': '检测 UUID',
    'inferIntegerStrings': '检测整数字符串',
    'inferBooleanStrings': '检测布尔字符串',
    'combineClasses': '合并相似类',
    'ignoreJsonRefs': '不将 $ref 视为 JSON 引用',
    'allPropertiesOptional': '所有属性设为可选',
    // TypeScript / JavaScript
    'just-types': '仅生成类型定义',
    'nice-property-names': '使用惯用属性名',
    'explicit-unions': '显式命名联合类型',
    'runtime-typecheck': '运行时验证 JSON.parse',
    'runtime-typecheck-ignore-unknown-properties': '验证时忽略未知属性',
    'prefer-unions': '使用联合类型替代枚举',
    'prefer-types': '使用 type 替代 interface',
    'prefer-const-values': '单值枚举使用字符串常量',
    'readonly': '使用 readonly 修饰符',
    'acronym-style': '缩写命名风格',
    'converters': '生成转换器',
    // Java / Kotlin
    'package': '包名',
    'just-types-and-package': '仅生成类型和包',
    'lombok': '使用 Lombok 注解',
    'array-type': '数组类型',
    // C# / C++
    'namespace': '命名空间',
    'density': '代码密度',
    'features': '功能特性',
    'output-features': '输出特性',
    'boost': '使用 Boost 库',
    'type-style': '类型命名风格',
    'member-style': '成员命名风格',
    'enumerator-style': '枚举命名风格',
    // Go
    'field-tags': '字段标签',
    'omit-empty': '省略空值',
    // Swift
    'struct-or-class': '使用 struct 或 class',
    'access-level': '访问级别',
    'objective-c-support': 'Objective-C 兼容',
    'swift-5-support': 'Swift 5 支持',
    'url-session': '使用 URLSession',
    'alamofire': '使用 Alamofire',
    'coding-keys': '生成 CodingKeys',
    'initializers': '生成初始化方法',
    'mutable-properties': '可变属性',
    // Rust
    'edition-2018': 'Rust 2018 edition',
    'visibility': '可见性',
    'derive-debug': '派生 Debug',
    // Python
    'python-version': 'Python 版本',
    // Dart
    'null-safety': '空安全',
    'use-freezed': '使用 Freezed',
    'use-hive': '使用 Hive',
    'use-json-annotation': '使用 JSON 注解',
    'part-name': 'Part 文件名',
}
const translateOption = (name: string, description: string) => {
    return optionTranslations[name] || description
}

watch(() => {
    return {
        lang: current.lang,
        json: props.json,
        options: current.option
    }
}, async ({ lang, json, options }) => {
    // 语言未选中时不执行转换
    if (!lang) {
        output = "";
        return;
    }
    if (json.isError()) {
        output = json.error();
        return;
    }
    if (json.isEmpty()) {
        output = "";
        return;
    }
    output = await transform(lang, json.toJson(), options[lang])
    emit('success')
}, { immediate: true, deep: true })
</script>
