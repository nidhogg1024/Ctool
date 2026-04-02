<template>
    <Align direction="vertical">
        <Input v-model="action.current.input" class="ctool-crontab-input" :label="$t('crontab_expression')">
            <template #suffix>
                <Align>
                    <HelpTip link="https://www.npmjs.com/package/cron-parser"/>
                    <Button size="small" type="primary" :text="$t(`crontab_generate`)" @click="isGenerate = !isGenerate"/>
                    <Button size="small" :loading="aiLoading" @click="showAiGenerate = true">✨ {{ $t('main_crontab_ai_generate') }}</Button>
                </Align>
            </template>
        </Input>
        <HeightResize v-slot="{height}" :append="['.ctool-crontab-input']" v-row="'10-14'" :reduce="5">
            <Textarea :model-value="output" :height="height" :placeholder="$t('crontab_execute_time')"/>
            <Tabs
                model-value="example"
                :lists="[
                    {name:`example`,label:$t('crontab_example')},
                    {name:`format`,label:$t('crontab_format')},
                    {name:`symbol`,label:$t('crontab_symbol')},
                ]"
                :height="height"
                padding="0"
                v-if="!isGenerate"
            >
                <Table
                    :columns="[{key:'exp',title:$t(`crontab_example`),width:150},{key:'text',title:$t(`crontab_description`)}]"
                    :lists="example.map((item)=>{return {exp:item,text:conversion(item)}})"
                />
                <Link href="https://www.npmjs.com/package/cron-parser" style="height: 100%;display: flex;justify-content: center;align-items: center">
                    <img src="@/statics/tools/crontab/crontab.png" style="max-width: 95%;max-height: 95%" alt="crontab">
                </Link>
                <Table
                    :height="height-40"
                    :columns="[{key:'name',title:$t('crontab_symbol'),width:100},{key:'text',title:$t(`crontab_description`)}]"
                    :lists="symbol"
                />
            </Tabs>
            <Generate v-else :height="height" v-model="action.current.input"/>
        </HeightResize>
    </Align>
    <!-- AI 生成 Cron 弹窗 -->
    <Modal v-model="showAiGenerate" :title="$t('main_crontab_ai_generate')" footer-type="normal" :loading="aiLoading" @ok="aiGenerateCron()">
        <Textarea v-model="aiPromptText" :height="100" :placeholder="$t('main_crontab_ai_generate_placeholder')" />
    </Modal>
</template>

<script lang="ts" setup>
import {initialize, useAction} from "@/store/action";
import cronstrue from 'cronstrue/i18n';
import parser from 'cron-parser';
import {watch} from 'vue';
import dayjs from 'dayjs';
import Generate from './generate/Generate.vue';
import HeightResize from "@/components/HeightResize.vue";
import Align from "@/components/Align.vue";
import Link from "@/components/ui/Link.vue";
import Input from "@/components/ui/Input.vue";
import Tabs from "@/components/ui/Tabs.vue";
import Textarea from "@/components/ui/Textarea.vue";
import Table from "@/components/ui/Table.vue";
import Button from "@/components/ui/Button.vue";
import Modal from "@/components/Modal.vue";
import useSetting from "@/store/setting";
import { chat, extractCode} from "@/helper/llm";
import type {AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const storeSetting = useSetting();
const locale = $computed(() => $t('main_locale'))

const action = useAction(await initialize({
    input: "2,3 */5 * * 2-5",
}, {
    paste: (str) => [5, 6].includes(str.trim().split(" ").length),
}))

const isGenerate = $ref(false)
let output = $ref("")

// AI 相关状态
let showAiGenerate = $ref(false)
let aiPromptText = $ref("")
let aiLoading = $ref(false)

const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
})

const aiGenerateCron = async () => {
    if (!aiPromptText.trim()) {
        Message.error($t("main_crontab_ai_generate_empty"))
        return
    }
    const config = getAiConfig()
    if (!config.baseUrl || !config.model) {
        Message.error($t("main_ai_not_configured"))
        return
    }
    aiLoading = true
    try {
        const result = await chat([
            {
                role: "system",
                content: "你是一个 Cron 表达式专家。根据用户的自然语言描述，生成对应的标准 Cron 表达式（5 段格式：分 时 日 月 周）。\n\n规则：\n1. 只输出 Cron 表达式，不要输出任何解释或 Markdown 标记\n2. 使用标准 5 段 Cron 格式（分钟 小时 日 月 星期）\n3. 星期使用 0-7（0 和 7 都代表周日）",
            },
            { role: "user", content: aiPromptText.trim() },
        ], config)
        action.current.input = extractCode(result.content)
        showAiGenerate = false
        aiPromptText = ""
    } catch (e: any) {
        Message.error($t("main_ai_request_error", [e?.message || String(e)]))
    } finally {
        aiLoading = false
    }
}

const conversion = (exp: string) => {
    return cronstrue.toString(exp, {locale, use24HourTimeFormat: true})
}
watch(() => {
    return {
        input: action.current.input
    }
}, ({input}) => {
    output = ""
    input = input.trim()
    if (input === "") {
        return;
    }
    const list: string[] = [];
    try {
        const msg = conversion(input);
        if (input.includes("L")) {
            list.push($t('crontab_l_prompt'), "")
        }
        if (input.split(" ").length > 5) {
            list.push($t('crontab_second_prompt'), "")
        }
        list.push(msg);
        list.push("", $t('crontab_execute_time_list'));
        const interval = parser.parseExpression(input);
        for (let i = 1; i <= 10; i++) {
            list.push($t('crontab_no', [i, dayjs(interval.next().toString()).format("YYYY-MM-DD HH:mm:ss")]))
        }
        action.save()
    } catch (e) {
        list.push($error(e))
    }
    output = list.join("\n");
}, {immediate: true})

const example = [
    "* * * * *",
    "*/5 */5 * * *",
    "* 10/5 * * *",
    "1 1-10 * * *",
    "0 1,2 * * *",
    "1 2 3 4,6,10 *",
    "0 * L * *",
    "0 1 * * 0",
    "0 1 * * 7",
    "0 1 * * 1",
    "0 1 * * 2-5",
    "0 1 * * 2,5",
    "0 1 * * 1L",
    "0 1 * * 1L,2L",
    "*/5 1-10,17,22 L 1-2,3/2 1L,2L",
]
const symbol = $computed(() => {
    return [
        {
            name: "*",
            text: $t('crontab_symbol_description_1')
        },
        {
            name: ",",
            text: $t('crontab_symbol_description_2')
        },
        {
            name: "-",
            text: $t('crontab_symbol_description_3')
        },
        {
            name: "/n",
            text: $t('crontab_symbol_description_4')
        }
    ]
})
</script>
