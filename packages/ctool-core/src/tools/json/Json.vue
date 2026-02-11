<template>
    <div>
        <HeightResize v-slot="{ height }" :append="['.ctool-page-option']">
            <div :style="layoutStyle">
                <Editor
                    v-model="action.current.input"
                    :line-info="action.current.option.info.line"
                    :placeholder="`Json ${$t('main_ui_input')}`"
                    lang="json"
                    :height="`${height}px`"
                />
                <Path
                    v-if="action.current.expand_type === 'path'"
                    :height="height"
                    :json="inputSerialize"
                    v-model="action.current.option.path"
                    @success="() => action.save()"
                />
                <Schema
                    v-if="action.current.expand_type === 'json_schema'"
                    :height="height"
                    :json="inputSerialize"
                    v-model="action.current.option.schema"
                    @success="() => action.save()"
                />
                <Transform
                    v-if="action.current.expand_type === 'transform'"
                    :height="height"
                    :json="inputSerialize"
                    v-model="action.current.option.transform"
                    @success="() => action.save()"
                />
                <ToObject
                    v-if="action.current.expand_type === 'object'"
                    :height="height"
                    :json="inputSerialize"
                    v-model="action.current.option.to_object"
                    @success="() => action.save()"
                />
            </div>
        </HeightResize>
        <Display position="top-right" class="ctool-page-option" style="margin-top: 5px">
            <template #extra>
                <Align>
                    <Bool size="small" border v-model="action.current.option.info.line" :label="$t('json_line_info')" />
                    <Button @click="general.repair()" type="primary" size="small" :text="$t('json_repair')" />
                    <HelpTip link="https://www.npmjs.com/package/jsonrepair" />
                </Align>
            </template>
            <Tabs
                v-model="action.current.tabs"
                :lists="[
                    { label: $t(`json_common`), name: `common` },
                    { label: `Path`, name: `path` },
                    { label: $t(`json_object`), name: `object` },
                    { label: $t(`json_go_convert`), name: `convert` },
                    { label: $t(`json_transform`), name: `transform` },
                ]"
            >
                <!-- 常用 -->
                <Align>
                    <Button @click="general.beautify()">{{ $t(`json_format`) }}</Button>
                    <Button v-if="formatError" type="primary" @click="general.repair()">{{ $t(`json_try_repair`) }}</Button>
                    <Select
                        :model-value="action.current.option.tab"
                        @change="value => general.tabs(value)"
                        :placeholder="$t('json_format')"
                        :options="tabOptions"
                    />
                    <Button @click="general.compress()">{{ $t(`json_compress`) }}</Button>
                    <span>|</span>
                    <Dropdown
                        @select="value => general[value]()"
                        :placeholder="$t(`json_escape`)"
                        :options="[
                            { label: $t('json_add_escape'), value: 'escape' },
                            { label: $t('json_clear_escape'), value: 'clearEscape' },
                        ]"
                    />
                    <Dropdown
                        @select="value => general[value]()"
                        placeholder="Unicode"
                        :options="[
                            { label: $t('json_unicode_to_zh'), value: 'unicode2zh' },
                            { label: $t('json_zh_to_unicode'), value: 'zh2unicode' },
                        ]"
                    />
                    <span>|</span>
                    <Dropdown
                        @select="value => general.sort(value)"
                        :placeholder="$t('json_key_sort')"
                        :options="[
                            { label: $t('json_asc'), value: 'asc' },
                            { label: $t('json_desc'), value: 'desc' },
                        ]"
                    />
                    <Dropdown
                        @select="value => general.rename(value)"
                        :placeholder="$t('json_key_rename')"
                        :options="renameTypeLists"
                    />
                    <span>|</span>
                    <Button @click="setExpandType('json_schema')">Schema</Button>
                </Align>
                <!-- Path -->
                <Align>
                    <template v-for="item in pathLists">
                        <Button
                            :size="size"
                            :text="item.label"
                            :type="item.value === action.current.option.path.type ? 'primary' : 'general'"
                            @click="togglePath(item.value)"
                        />
                    </template>
                </Align>
                <!-- 转实体类：热门语言按钮 + 更多语言下拉 -->
                <Align>
                    <template v-for="item in hotLangs">
                        <Button
                            :size="size"
                            :text="getDisplayName(item)"
                            :type="item === action.current.option.to_object.lang ? 'primary' : 'general'"
                            @click="toggleObject(item)"
                        />
                    </template>
                    <Dropdown
                        :placeholder="$t('json_more_langs')"
                        :options="moreLangOptions"
                        @select="toggleObject"
                    />
                </Align>
                <!-- 格式转换（占位，点击时直接跳转） -->
                <Align />
            </Tabs>
        </Display>
    </div>
</template>

<script lang="ts" setup>
import { StyleValue, watch } from "vue";
import Json from "@/helper/json";
import { useAction, initialize } from "@/store/action";
import { tabOptions, actionType, TabsType, pathLists } from "./define";
import { createSerializeInput, createSerializeOutput } from "@/components/serialize";
import Schema from "./Schema.vue";
import Transform from "./Transform.vue";
import Path from "./Path.vue";
import Serialize from "@/helper/serialize";
import { typeLists as renameTypeLists, TypeLists as RenameType } from "@/helper/nameConvert";
import util from "./util";
import { getDisplayName } from "@/helper/code";
import { jsonrepair } from "jsonrepair";
import { ComponentSizeType } from "@/types";
import ToObject from "./toObject/ToObject.vue";
import { languages as toObjectLangLists, getOption as getToObjectOption } from "./toObject";
import useOperate from "@/store/operate";
import useTransfer from "@/store/transfer";

const operate = useOperate();
const transfer = useTransfer();

const action = useAction(
    await initialize<actionType>(
        {
            input: "",
            tabs: "common",
            expand_type: "",
            option: {
                info: {
                    line: true,
                },
                schema: {
                    exp: "",
                    option: {},
                },
                path: {
                    type: "json_path",
                    json_path: "",
                    jmes_path: "",
                },
                tab: 4,
                from: createSerializeInput("csv"),
                to: createSerializeOutput("xml"),
                to_object: getToObjectOption(""),
                transform: {
                    expression: "",
                },
            },
        },
        { paste: false },
    ),
);

// 格式化失败标志，用于显示"尝试修复"提示
let formatError = $ref(false);

const size: ComponentSizeType = "default";

// 转实体类：按语言热度分层展示
// 热门语言直接按钮展示（参考 TIOBE / Stack Overflow 热度排序）
const hotLangs = ['TypeScript', 'Python', 'C++', 'Java', 'C#', 'Go', 'Kotlin', 'Swift', 'Rust']
    .filter(lang => toObjectLangLists.includes(lang));
// 中频语言收进下拉
const moreLangs = ['Dart', 'Ruby', 'PHP', 'JavaScript', 'Objective-C', 'Scala3', 'JSON Schema', 'ProtoBuf']
    .filter(lang => toObjectLangLists.includes(lang));
const moreLangOptions = moreLangs.map(item => ({
    label: getDisplayName(item),
    value: item,
}));

// 布局
const layoutStyle = $computed(() => {
    const css: StyleValue = {};
    if (["path", "json_schema", "transform", "object"].includes(action.current.expand_type)) {
        css.display = "grid";
        css.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
        css.columnGap = "5px";
    }
    return css;
});

const general = {
    tabs(tab: TabsType) {
        action.current.option.tab = tab;
        this.beautify();
    },
    getInput(code?: string) {
        return (code || action.current.input).trim();
    },
    // 美化
    async beautify(code?: string, copy = true) {
        try {
            action.current.input = await util.beautify(this.getInput(code), { tab: action.current.option.tab });
            formatError = false;
            if (!copy) {
                return action.save();
            }
            action.success({ copy_text: action.current.input });
        } catch (e) {
            // 格式化失败，显示"尝试修复"提示
            formatError = true;
            throw e;
        }
    },
    // 压缩
    async compress() {
        action.current.input = await util.compress(this.getInput());
        action.success({ copy_text: action.current.input });
    },
    // 重命名
    rename(type: RenameType) {
        const code = this.getInput();
        if (code === "") {
            return;
        }
        this.beautify(Json.stringify(util.rename(Json.parse(code), type)));
    },
    // 排序
    sort(type: "asc" | "desc") {
        const code = this.getInput();
        if (code === "") {
            return;
        }
        this.beautify(Json.stringify(util[type === "asc" ? "sortAsc" : "sortDesc"](Json.parse(code))));
    },
    unicode2zh() {
        const code = this.getInput();
        if (code !== "") {
            action.current.input = util.unicode2zh(code);
            action.success({ copy_text: action.current.input });
        }
    },
    zh2unicode() {
        const code = this.getInput();
        if (code !== "") {
            action.current.input = util.zh2unicode(code);
            action.success({ copy_text: action.current.input });
        }
    },
    escape() {
        const code = this.getInput();
        if (code !== "") {
            action.current.input = util.escape(code);
            action.success({ copy_text: action.current.input });
        }
    },
    clearEscape() {
        const code = this.getInput();
        if (code !== "") {
            action.current.input = util.clearEscape(code);
            action.success({ copy_text: action.current.input });
        }
    },
    repair() {
        const code = this.getInput();
        if (code !== "") {
            formatError = false;
            // 先尝试移除转义后格式化（处理 {\"key\":\"value\"} 类输入）
            if (code.includes('\\"')) {
                try {
                    const unescaped = util.clearEscape(code);
                    JSON.parse(unescaped);
                    this.beautify(unescaped);
                    return;
                } catch { /* 移除转义后仍不合法，走 jsonrepair 兜底 */ }
            }
            this.beautify(jsonrepair(code));
        }
    },
};

// 输入变化时重置格式化错误提示
watch(() => action.current.input, () => {
    formatError = false;
});

const inputSerialize: Serialize = $computed(() => {
    try {
        const code = action.current.input.trim();
        if (code === "") {
            return Serialize.empty();
        }
        return Serialize.formJson(code);
    } catch (e) {
        return Serialize.fromError($error(e));
    }
});

// 切换
const toggleObject = lang => {
    action.current.option.to_object.lang = lang;
    action.current.expand_type = 'object';
};
const togglePath = item => {
    action.current.option.path.type = item;
};
const setExpandType = value => {
    if (value !== "" && action.current.expand_type === value) {
        action.current.expand_type = "";
        return;
    }
    action.current.expand_type = value;
};

// 带数据跳转到格式转换工具
const goConfigConvert = () => {
    const input = action.current.input.trim();
    if (input) {
        transfer.set(input, 'json');
    }
    operate.redirectTool("configConvert", "configConvert", "conversion");
};

watch(
    () => action.current.tabs,
    tabs => {
        // 点击「格式转换」tab 时，带数据跳转到 configConvert
        if (tabs === 'convert') {
            goConfigConvert();
            action.current.tabs = 'common';
            return;
        }
        // 切换到「转实体类」时，自动选中默认语言（避免空语言报错）
        if (tabs === 'object' && !action.current.option.to_object.lang) {
            action.current.option.to_object.lang = hotLangs[0] || 'TypeScript';
        }
        setExpandType(["path", "object", "transform"].includes(tabs) ? tabs : "");
    },
);
</script>
