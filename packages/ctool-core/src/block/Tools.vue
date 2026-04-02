<template>
    <Align direction="vertical">
        <Card :title="$t('main_ai_tools')">
            <Align>
                <Button type="dotted" :size="size" @click="selectTool(item.tool.name, undefined, item.name)" v-for="item in aiFeatures">
                    <span class="ctool-tool-button-label">{{ featureLabel(item) }}</span>
                    <AiBadge variant="inline" />
                </Button>
            </Align>
            <template #extra>
                <span class="ctool-ai-summary">{{ $t('main_ai_tools_count', [aiFeatures.length]) }}</span>
            </template>
        </Card>
        <Card :title="$t(`main_category_common`)">
            <Align>
                <Button type="dotted" :size="size" @click="selectTool(name)" v-for="name in operate.getSmartCommon(setting.items.common)">
                    <span class="ctool-tool-button-label">{{ $t(`tool_${name}`) }}</span>
                    <AiBadge v-if="toolSupportsAi(name)" variant="inline" />
                </Button>
            </Align>
            <template #extra>
                <Button type="primary" :text="$t('main_ui_setting')" @click="openCommon = true" size="small"/>
            </template>
        </Card>
        <Card :title="$t(`main_recently_use`)">
            <Align>
                <Button type="dotted" :size="size" @click="selectTool(item.tool.name,undefined,item.name)" v-for="item in recently">
                    <span class="ctool-tool-button-label">{{ featureLabel(item) }}</span>
                    <AiBadge v-if="featureSupportsAi(item.tool.name, item.name)" variant="inline" />
                </Button>
            </Align>
        </Card>
        <Card :title="$t(`main_category_${cate.name}`)" v-for="cate in categories">
            <Align>
                <template v-for="tool in cate.tools">
                    <Button type="dotted" :size="size" @click="selectTool(tool.name,cate,item.name)" v-for="item in tool.features">
                        <span class="ctool-tool-button-label">{{ featureLabel(item) }}</span>
                        <AiBadge v-if="featureSupportsAi(item.tool.name, item.name)" variant="inline" />
                    </Button>
                </template>
            </Align>
        </Card>
        <ExtendPage v-model="openCommon" disable-replace>
            <Common/>
        </ExtendPage>
    </Align>
</template>
<script setup lang="ts">
import useOperate from "@/store/operate";
import useSetting from "@/store/setting";
import {categories, CategoryInterface, ToolType, FeatureInterface, FeatureType} from "@/config"
import Common from "./Common.vue";
import {ComponentSizeType} from "@/types";
import AiBadge from "@/components/AiBadge.vue";
import {featureSupportsAi, getAiSupportedFeatures, toolSupportsAi} from "@/helper/ai";

const operate = useOperate()
const setting = useSetting()
const openCommon = $ref(false)

const size: ComponentSizeType = "default"
const aiFeatures = getAiSupportedFeatures()

const selectTool = (tool: ToolType, category?: CategoryInterface, feature?: FeatureType) => {
    operate.redirectTool(tool, feature || operate.getToolLastFeature(tool), category ? category.name : "")
}

const featureLabel = (feature: FeatureInterface) => {
    return `${$t(`tool_${feature.tool.name}`)}${feature.tool.isSimple() ? `` : ` - ${$t(`tool_${feature.tool.name}_${feature.name}`)}`}`
}

const recently: FeatureInterface[] = $computed(() => {
    return operate.getRecently().slice(0, 10)
})
</script>

<style scoped>
.ctool-tool-button-label {
    display: inline-flex;
    align-items: center;
}

.ctool-ai-summary {
    font-size: 12px;
    color: var(--ctool-info-color);
}
</style>
