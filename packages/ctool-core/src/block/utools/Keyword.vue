<template>
    <Card :title="`uTools - ${$t(`main_ui_keyword`)}${$t(`main_ui_config`)}`" height="100%">
        <div class="ctool-utools-keyword-tip">
            {{ $t('main_utools_keyword_tip') }}
        </div>
        <div v-row="`1-1-1-1`">
            <Textarea
                :height="180"
                v-for="key in itemsKey"
                :key="key"
                v-model="items[key].cmds"
                :float-text="items[key].title"
                float-position="bottom-right"
            />
        </div>
        <template #extra>
            <Align>
                <Button :size="'small'" @click="save" :text="$t('main_ui_save')" type="primary"/>
                <Button :size="'small'" @click="enableAll" :text="$t('main_utools_keyword_enable_all')"/>
                <Button :size="'small'" @click="restoreDefaults" :text="$t('main_utools_keyword_restore_default')" type="danger"/>
            </Align>
        </template>
    </Card>
</template>

<script setup lang="ts">
import {runtime} from 'ctool-adapter-utools'
import {FeatureInterface} from '@/config'
import Message from "@/helper/message";

type Item = {
    feature: FeatureInterface,
    title: string
    cmds: string
}

const getFeatures = () => {
    const lists: Record<string, Item> = {}
    runtime.getFeatures().forEach((value, feature) => {
        lists[`${feature.getKey()}`] = {
            feature,
            title: feature.tool.isSimple() ? $t(`tool_${feature.tool.name}`) : `${$t(`tool_${feature.tool.name}`)} - ${$t(`tool_${feature.tool.name}_${feature.name}`)}`,
            cmds: value.join("\n")
        }
    })
    return lists
}

let items = $ref(getFeatures())

const itemsKey = Object.keys(items)

const runFeatureAction = (action: () => void) => {
    try {
        action()
        items = getFeatures()
        Message.success($t('main_ui_success'))
    } catch (error) {
        try {
            items = getFeatures()
        } catch {
        }
        Message.error($t('main_utools_keyword_save_failed', [
            error instanceof Error ? error.message : String(error),
        ]))
    }
}

const save = () => {
    const features: { feature: FeatureInterface, cmds: string[] }[] = []
    itemsKey.forEach(key => {
        const cmds = [...(new Set(items[key].cmds.split("\n").map(item => item.trim()).filter(item => item !== "")))]
        if (cmds.length > 0) {
            features.push({
                feature: items[key].feature,
                cmds
            })
        }
    })
    runFeatureAction(() => runtime.setFeatures(features))
}
const restoreDefaults = () => {
    runFeatureAction(() => runtime.resetFeatures())
}

const enableAll = () => {
    runFeatureAction(() => runtime.enableAllFeatures())
}
</script>

<style scoped>
.ctool-utools-keyword-tip {
    margin-bottom: 12px;
    color: var(--muted-color);
    font-size: 13px;
}
</style>
