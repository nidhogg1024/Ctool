<template>
    <Align horizontal="right" class="ctool-page-option" :bottom="'default'">
        <Button :size="'small'" :loading="aiExplainLoading" @click="aiExplainUrl()">✨ {{ $t('main_urlParse_ai_explain') }}</Button>
    </Align>
    <HeightResize v-slot="{small,large}" :reduce="5" ignore :append="['.ctool-page-option']">
        <Align direction="vertical">
            <Textarea :height="small" :placeholder="$t(`main_ui_input`)" v-model="action.current.input"/>
            <div :style="{height: `${large}px`}" style="display: grid;grid-template-rows: auto minmax(0,1fr);gap: 5px">
                <Align direction="vertical">
                    <Input label="Base" :model-value="output.base"/>
                    <Input label="Path" :model-value="output.path"/>
                    <Input label="Hash" :model-value="output.hash"/>
                </Align>
                <SerializeOutput
                    placeholder="Query"
                    :content="output.query"
                    v-model="action.current.querySerializeOption"
                    @success="action.save()"
                />
            </div>
        </Align>
    </HeightResize>
    <Modal v-model="showAiExplain" :title="$t('main_urlParse_ai_explain_result')" width="70%">
        <Textarea :model-value="aiExplainText" :height="220" readonly />
    </Modal>
</template>

<script lang="ts" setup>
import {initialize, useAction} from "@/store/action";
import {watch} from "vue";
import {createSerializeOutput} from "@/components/serialize";
import Serialize from "@/helper/serialize";
import Button from "@/components/ui/Button.vue";
import Modal from "@/components/Modal.vue";
import Textarea from "@/components/ui/Textarea.vue";
import useSetting from "@/store/setting";
import { chat} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const action = useAction(await initialize({
    input: "",
    querySerializeOption: createSerializeOutput('json')
}, {paste: (item) => item.includes("://")}))
const storeSetting = useSetting()
let showAiExplain = $ref(false)
let aiExplainText = $ref("")
let aiExplainLoading = $ref(false)

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
})

const output = $computed(() => {
    const input = action.current.input.trim()
    if (input === "") {
        return {
            base: "",
            path: "",
            query: Serialize.formQueryString(""),
            hash: ""
        }
    }
    try {
        const url = new URL(action.current.input)
        return {
            base: url.origin,
            path: url.pathname,
            query: Serialize.formQueryString((url.search.startsWith("?") ? url.search.substring(1) : url.search) || ""),
            hash: url.hash
        }
    } catch (e) {
        return {
            base: $error(e),
            path: "",
            query: Serialize.formQueryString(""),
            hash: ""
        }
    }
})

const aiExplainUrl = async () => {
    const input = action.current.input.trim()
    if (!input) {
        Message.error($t("main_urlParse_ai_explain_empty"))
        return
    }
    const config = getAiConfig()
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"))
        return
    }
    aiExplainLoading = true
    try {
        const result = await chat([
            {
                role: "system",
                content: "你是一个 URL 分析助手。请用简洁中文解释这个 URL 的作用，尽量覆盖域名、路径、关键查询参数、hash，以及可能暴露的业务含义或敏感信息。",
            },
            {
                role: "user",
                content: JSON.stringify({
                    raw: input,
                    base: output.base,
                    path: output.path,
                    query: output.query.content(),
                    hash: output.hash,
                }, null, 2),
            },
        ], config)
        aiExplainText = result.content
        showAiExplain = true
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]))
    } finally {
        aiExplainLoading = false
    }
}

watch(() => {
    return {url: action.current.input}
}, () => {
    try {
        new URL(action.current.input)
        action.save()
    } catch (_) {
    }
}, {immediate: true})
</script>
