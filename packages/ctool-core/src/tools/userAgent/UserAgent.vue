<template>
    <Align direction="vertical">
        <Align horizontal="center" class="ctool-page-option" :bottom="'default'">
            <Input size="large" :width="600" v-model="action.current.input" :placeholder="$t('userAgent_placeholder')" />
            <Button size="large" :text="$t('userAgent_current')" @click="useCurrent" />
            <Button size="large" :loading="aiExplainLoading" :text="`✨ ${$t('main_userAgent_ai_explain')}`" @click="aiExplainUserAgent" />
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
    <Modal v-model="showAiExplain" :title="$t('main_userAgent_ai_explain_result')" width="70%">
        <Textarea :model-value="aiExplainText" :height="220" readonly />
    </Modal>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import { UAParser } from "ua-parser-js";
import Item from "../ipcalc/Item.vue";
import Modal from "@/components/Modal.vue";
import Textarea from "@/components/ui/Textarea.vue";
import useSetting from "@/store/setting";
import { chat} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const action = useAction(await initialize({
    input: "",
}));
const storeSetting = useSetting();

let parsed = $ref<ReturnType<UAParser["getResult"]> | null>(null);
let showAiExplain = $ref(false);
let aiExplainText = $ref("");
let aiExplainLoading = $ref(false);

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
});

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

const aiExplainUserAgent = async () => {
    const input = action.current.input.trim();
    if (!input) {
        Message.error($t("main_userAgent_ai_explain_empty"));
        return;
    }
    const config = getAiConfig();
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"));
        return;
    }
    aiExplainLoading = true;
    try {
        const result = await chat([
            {
                role: "system",
                content: "你是一个 User-Agent 解释助手。请用简洁中文解释这个 User-Agent 代表的浏览器、内核、操作系统、设备类型，并补充 1-2 条与兼容性或排查相关的提示。",
            },
            {
                role: "user",
                content: JSON.stringify({
                    raw: input,
                    parsed,
                }, null, 2),
            },
        ], config);
        aiExplainText = result.content;
        showAiExplain = true;
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]));
    } finally {
        aiExplainLoading = false;
    }
};

watch(() => action.current.input, () => parse(), { immediate: true });
</script>
