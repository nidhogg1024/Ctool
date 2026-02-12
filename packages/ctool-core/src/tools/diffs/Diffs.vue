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
            <Select size="small" v-model="action.current.option.lang" :options="allLanguage" filterable filter-placeholder="Search language..." />
        </Diff>
    </HeightResize>
</template>
<script lang="ts" setup>
import { watch, ref, computed } from "vue";
import { initialize, useAction } from "@/store/action";
import { allLanguage } from "@/helper/code";
import Diff from "@/components/editor/Diff.vue";
import formatter from "@/tools/code/formatter";

type DataType = {
    original: string;
    modified: string;
    option: {
        lang: string;
    };
};
const diffRef = ref<InstanceType<typeof Diff> | null>(null);

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

// 当前语言是否支持格式化
const canBeautify = computed(() => formatter.isEnable(action.current.option.lang, "beautify"));

// 一键格式化左右两侧代码
const beautify = async () => {
    await diffRef.value?.beautifyBoth(async (lang: string, code: string) => {
        return await formatter.simple(lang, "beautify", code) as string;
    });
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
