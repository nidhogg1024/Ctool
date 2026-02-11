<template>
    <Align direction="vertical">
        <Align horizontal="center" class="ctool-page-option" :bottom="'default'">
            <Input size="large" :width="600" v-model="action.current.input" :placeholder="$t('userAgent_placeholder')" />
            <Button size="large" :text="$t('userAgent_current')" @click="useCurrent" />
        </Align>
        <Align direction="vertical" v-if="parsed">
            <Card :title="$t('userAgent_browser')" padding="0">
                <div style="display: grid; grid-template-columns: 1fr 1fr;">
                    <Item :title="$t('userAgent_name')" :value="parsed.browser.name || '-'" />
                    <Item :title="$t('userAgent_version')" :value="parsed.browser.version || '-'" />
                </div>
            </Card>
            <Card :title="$t('userAgent_engine')" padding="0">
                <div style="display: grid; grid-template-columns: 1fr 1fr;">
                    <Item :title="$t('userAgent_name')" :value="parsed.engine.name || '-'" />
                    <Item :title="$t('userAgent_version')" :value="parsed.engine.version || '-'" />
                </div>
            </Card>
            <Card :title="$t('userAgent_os')" padding="0">
                <div style="display: grid; grid-template-columns: 1fr 1fr;">
                    <Item :title="$t('userAgent_name')" :value="parsed.os.name || '-'" />
                    <Item :title="$t('userAgent_version')" :value="parsed.os.version || '-'" />
                </div>
            </Card>
            <Card :title="$t('userAgent_device')" padding="0">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr;">
                    <Item :title="$t('userAgent_model')" :value="parsed.device.model || '-'" />
                    <Item :title="$t('userAgent_type')" :value="parsed.device.type || $t('userAgent_desktop')" />
                    <Item :title="$t('userAgent_vendor')" :value="parsed.device.vendor || '-'" />
                </div>
            </Card>
            <Card :title="$t('userAgent_cpu')" padding="0">
                <div style="display: grid; grid-template-columns: 1fr;">
                    <Item :title="$t('userAgent_architecture')" :value="parsed.cpu.architecture || '-'" />
                </div>
            </Card>
        </Align>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import { UAParser } from "ua-parser-js";
import Item from "../ipcalc/Item.vue";

const action = useAction(await initialize({
    input: "",
}));

let parsed = $ref<ReturnType<UAParser["getResult"]> | null>(null);

const parse = () => {
    const ua = action.current.input.trim();
    if (!ua) { parsed = null; return; }
    const parser = new UAParser(ua);
    parsed = parser.getResult();
    action.save();
};

const useCurrent = () => {
    action.current.input = navigator.userAgent;
};

watch(() => action.current.input, () => parse(), { immediate: true });
</script>
