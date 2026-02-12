<template>
    <div class="ctool-header">
        <div class="ctool-header-top">
            <Github />
            <div class="ctool-header-top-left">
                <div
                    v-for="name in allCategories"
                    class="ctool-header-category"
                    :class="selectedCategory === name ? `ctool-header-category-current` : ``"
                    :key="name"
                    @click="selectCategory(name)"
                >
                    {{ $t(`main_category_${name}`) }}
                </div>
            </div>
            <div class="ctool-header-top-right">
                <Align>
                    <Search/>
                    <Icon :size="18" hover @click="openTools = !openTools" name="common" :tooltip="$t(`main_tools_lists`)"/>
                </Align>
            </div>
        </div>
        <div class="ctool-header-middle">
            <div
                v-for="name in categoryTools"
                class="ctool-header-tool"
                :class="storeOperate.items.tool === name ? `ctool-header-tool-current` : ``"
                :key="name"
                @click="selectTool(name)"
            >
                <Icon v-if="storeOperate.items.tool === name" :size="14" color="var(--primary)" name="checked"/>
                <Icon v-else :size="14" color="var(--ctool-border-color)" name="unchecked"/>
                <span>{{ $t(`tool_${name}`) }}</span>
            </div>
        </div>
        <div class="ctool-header-bottom" v-if="features.length > 1">
            <div
                v-for="feature in features"
                class="ctool-header-feature"
                :class="storeOperate.items.feature === feature.name ? `ctool-header-feature-current` : ``"
                :key="`${storeOperate.items.tool}-${feature.name}`"
                @click="selectFeature(feature)"
            >
                {{ $t(`tool_${storeOperate.items.tool}_${feature.name}`) }}
            </div>
        </div>
    </div>
    <ExtendPage v-model="openTools">
        <Tools/>
    </ExtendPage>
</template>

<script setup lang="ts">
import useOperate from "@/store/operate";
import useSetting from "@/store/setting";
import {getTool, toolExists, FeatureInterface, categories, getCategory, categoryExists} from "@/config";
import Search from "../../Search.vue";
import Tools from "../../Tools.vue";
import {nextTick, watch} from "vue";
import Github from "../../Github.vue";

const storeOperate = useOperate()
const storeSetting = useSetting()

const openTools = $ref(false);
let selectedCategory = $ref(storeOperate.items.category || "common")

const allCategories = ['common', ...categories.map(({name}) => name)]
const categoryTools = $computed(() => {
    if (categoryExists(selectedCategory)) {
        return getCategory(selectedCategory).tools.map(({name}) => name)
    }
    // 智能常用：置顶工具优先，按使用频率自动补充
    return storeOperate.getSmartCommon(storeSetting.items.common)
})

const selectCategory = (name: string) => {
    selectedCategory = name
    let tool = ""
    if (categoryExists(name)) {
        tool = storeOperate.getCategoryLastTool(name)
    } else {
        const smartCommon = storeOperate.getSmartCommon(storeSetting.items.common)
        for (const feature of storeOperate.getRecently()) {
            if (smartCommon.includes(feature.tool.name)) {
                tool = feature.tool.name
                break;
            }
        }
    }
    selectTool(tool || categoryTools[0])
}

const selectTool = (name: string) => {
    storeOperate.redirectTool(name, storeOperate.getToolLastFeature(name), selectedCategory)
}

const features = $computed(() => {
    return toolExists(storeOperate.items.tool) && !getTool(storeOperate.items.tool).isSimple() ? getTool(storeOperate.items.tool).features : []
})

const selectFeature = (feature: FeatureInterface) => {
    storeOperate.redirectTool(storeOperate.items.tool, feature.name, storeOperate.items.category)
}
watch(() => {
    return {
        tool: storeOperate.items.tool,
        category: storeOperate.items.category,

    }
}, ({tool, category}) => {
    if (!categoryTools.includes(tool as any)) {
        selectedCategory = category
    }
})

watch(() => {
    return {
        selectedCategory,
        tool: storeOperate.items.tool,
    }
}, async () => {
    await nextTick()
    window.dispatchEvent(new Event('resize'));
}, {immediate: true})
</script>

<style scoped>
.ctool-header-top {
    padding: 0 10px;
    height: 33px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: auto minmax(0px, 1fr) auto;
    border-bottom: solid 1px var(--ctool-border-color);
    background-color: var(--ctool-block-title-bg-color);
    overflow: hidden;
}

.ctool-header-top-left {
    display: inline-flex;
    align-items: center;
    padding-left: 5px;
    /* 分类标签超出时横向可滚动（uTools 等固定宽度环境需要） */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    flex-shrink: 1;
    min-width: 0;
}
.ctool-header-top-left::-webkit-scrollbar {
    display: none;
}

.ctool-header-top-right {
    display: inline-flex;
    align-items: center;
}

.ctool-header-category {
    font-size: 13px;
    display: inline-flex;
    height: 100%;
    align-items: center;
    padding: 0 .5rem;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}
[data-locale="en"] .ctool-header-category{
    padding: 0 .3rem;
}
.ctool-header-middle {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 20px;
    padding: 10px 10px 5px;
}

.ctool-header-tool {
    cursor: pointer;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
}

.ctool-header-category-current {
    color: var(--ctool-primary);
    border-bottom: 2px solid var(--ctool-primary);
}

.ctool-header-category:hover {
    background-color: var(--primary-focus);
}

.ctool-header-bottom {
    box-sizing: border-box;
    font-size: 14px;
    padding: 0 10px;
    height: 26px;
    border-bottom: solid 1px var(--ctool-border-color);
    overflow: hidden;
    display: flex;
    justify-content: center;
}

.ctool-header-feature {
    display: inline-flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    padding: 0 1rem;
    cursor: pointer;
    white-space: nowrap;
}

.ctool-header-feature:hover {
    background-color: var(--primary-focus);
}

.ctool-header-feature-current {
    color: var(--ctool-primary);
    border-bottom: 2px solid var(--ctool-primary);
}

/* ===== 小屏适配（≤768px） ===== */
@media (max-width: 768px) {
    /* 顶部栏：增高以适应触摸 */
    .ctool-header-top {
        height: 42px;
        padding: 0 8px;
    }

    .ctool-header-category {
        padding: 0 0.6rem;
        font-size: 13px;
        flex-shrink: 0;
    }

    /* 工具列表区域：限高 + 可滚动 */
    .ctool-header-middle {
        max-height: 80px;
        overflow-y: auto;
        padding: 8px 8px 4px;
        gap: 8px 6px;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .ctool-header-middle::-webkit-scrollbar {
        display: none;
    }

    .ctool-header-tool {
        font-size: 13px;
        padding: 2px 0;
    }

    /* feature 标签栏：横向可滚动 */
    .ctool-header-bottom {
        height: 32px;
        overflow-x: auto;
        overflow-y: hidden;
        justify-content: flex-start;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .ctool-header-bottom::-webkit-scrollbar {
        display: none;
    }

    .ctool-header-feature {
        padding: 0 0.7rem;
        font-size: 13px;
        flex-shrink: 0;
    }
}

/* ===== 极小屏（≤480px） ===== */
@media (max-width: 480px) {
    .ctool-header-top {
        height: 40px;
        padding: 0 4px;
    }

    .ctool-header-category {
        padding: 0 0.45rem;
        font-size: 12px;
    }

    .ctool-header-middle {
        max-height: 68px;
        padding: 6px 6px 3px;
        gap: 6px 4px;
    }

    .ctool-header-tool {
        font-size: 12px;
    }

    .ctool-header-feature {
        padding: 0 0.5rem;
        font-size: 12px;
    }
}

</style>
