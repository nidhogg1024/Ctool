<template>
    <HeightResize v-slot="{height}" v-row="`1-1`">
        <Display :position="'bottom-right'">
            <Editor :lang="action.current.source === 'cURL' ? 'shell' : 'json'" v-model="action.current.input" :height="height" :placeholder="$t(`main_ui_output`)"/>
            <template #extra>
                <Align>
                    <HelpTip
                            :link="action.current.source === 'cURL' ? 'https://everything.curl.dev/usingcurl/copyas' : 'http://www.softwareishard.com/blog/har-12-spec/#request'"
                    />
                    <Select :size="'small'" :options="['cURL','HAR']" v-model="action.current.source"/>
                    <Button :size="'small'" :loading="aiExplainLoading" @click="aiExplainRequest()">✨ {{ $t('main_httpSnippet_ai_explain') }}</Button>
                </Align>
            </template>
        </Display>
        <Display :position="'bottom-right'">
            <Display :position="'top-right'">
                <Editor :lang="targetInfo.targetId" :model-value="output[selected].value" :height="height" :placeholder="$t(`main_ui_output`)"/>
                <template #extra>
                    <Select
                            v-if="output.length > 1"
                            :size="'small'"
                            :options="range(0,output.length).map(index=>{return {value:index,label:`Entry ${index+1}`,description:output[index].url}})"
                            v-model="selected"/>
                </template>
            </Display>
            <template #extra>
                <Align>
                    <HelpTip v-if="targetInfo.url !== ''" :link="targetInfo.url"/>
                    <Select dialog :size="'small'" :options="targets" v-model="action.current.target"/>
                </Align>
            </template>
        </Display>
    </HeightResize>
    <Modal v-model="showAiExplain" :title="$t('main_httpSnippet_ai_explain_result')" width="70%">
        <Textarea :model-value="aiExplainText" :height="240" readonly />
    </Modal>
</template>

<script lang="ts" setup>
import {generate, targets, getTarget} from "./util";
import {initialize, useAction} from "@/store/action";
import {range} from 'lodash';
import {watch} from "vue";
import Button from "@/components/ui/Button.vue";
import Modal from "@/components/Modal.vue";
import Textarea from "@/components/ui/Textarea.vue";
import useSetting from "@/store/setting";
import { chat} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const action = useAction(await initialize({
    input: "",
    source: "cURL",
    target: "javascript-|-axios",
}, {paste: false}))
const storeSetting = useSetting()

const targetInfo = $computed(() => getTarget(action.current.target))

let selected = $ref(0);
let showAiExplain = $ref(false)
let aiExplainText = $ref("")
let aiExplainLoading = $ref(false)

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
})

const aiExplainRequest = async () => {
    const input = action.current.input.trim()
    if (!input) {
        Message.error($t("main_httpSnippet_ai_explain_empty"))
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
                content: "你是一个 HTTP 请求分析助手。用户会提供 cURL 或 HAR 内容，请用简洁中文说明请求在做什么，并尽量覆盖请求方法、目标接口、关键请求头、鉴权方式、主要参数/请求体，以及明显的敏感信息或调试风险。",
            },
            {
                role: "user",
                content: `Source: ${action.current.source}\nTarget: ${action.current.target}\nInput:\n${input}`,
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

const output = $computed(() => {
    if (action.current.input === "") {
        return [{value: "", url: ""}];
    }
    try {
        const result = generate(action.current.input, action.current.source, action.current.target)
        action.save()
        return result;
    } catch (e) {
        console.log(e)
        return [{value: $error(e), url: ""}]
    }
})

watch(
    () => {
        return {output}
    },
    () => {
        selected = 0;
    },
    {immediate: true, deep: true}
)

</script>
