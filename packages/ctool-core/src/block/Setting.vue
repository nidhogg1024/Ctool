<template>
    <Card :title="$t('main_ui_setting')" height="100%" padding="18px 18px 12px">
        <template #extra>
            Ctool v{{ version }} {{ $t(`main_last_updated`) }}{{ lastUpdate }}
        </template>
        <div class="ctool-setting">
            <template v-if="platform.isChromium()">
                <span>{{ $t('main_keyboard_setting') }}</span>
                <Link href="chrome://extensions/shortcuts">chrome://extensions/shortcuts</Link>
            </template>
            <span>{{ $t('main_display_mode') }}</span>
            <div>
                <Select
                    :model-value="storeSetting.items.theme"
                    @change="(value)=>storeSetting.save('theme',value)"
                    :options="themes.map((item)=>{return {value:item,label:$t(`main_display_mode_${item}`)}})"
                />
            </div>
            <span>{{ $t('main_setting_language') }}</span>
            <div>
                <Select
                    :model-value="storeSetting.items.locale"
                    @change="(value)=>storeSetting.save('locale',value)"
                    :options="localeOptions"
                />
            </div>
            <span>{{ $t('main_setting_layout') }}</span>
            <div>
                <Select
                    :model-value="storeSetting.items.layout"
                    @change="(value)=>storeSetting.save('layout',value)"
                    :options="['complex','simple'].map((item)=>{return {value:item,label:$t(`main_setting_layout_${item}`)}})"
                />
            </div>
            <span style="grid-row-start: span 3">{{ $t('main_ui_clipboard') }}</span>
            <div>
                <Bool
                    :label="$t(`main_copy_results_to_clipboard`)"
                    :model-value="storeSetting.items.auto_save_copy"
                    @change="(value)=>storeSetting.save('auto_save_copy',value)"
                />
            </div>
            <div>
                <Align>
                    <Bool
                        :disabled="clipboardState!=='granted'"
                        :label="$t(`main_read_content_from_clipboard`)"
                        :model-value="storeSetting.items.auto_read_copy"
                        @change="(value)=>storeSetting.save('auto_read_copy',value)"
                    />
                    <Link
                        v-if="clipboardState==='prompt'"
                        style="font-size: .875rem"
                        type="primary"
                        href="/tool.html#/clipboard"
                    >
                        {{ $t('main_clipboard_get') }}
                    </Link>
                </Align>
            </div>
            <div>
                <Bool
                    :disabled="!storeSetting.items.auto_read_copy"
                    :label="$t(`main_read_clipboard_content_trim`)"
                    :model-value="storeSetting.items.auto_read_copy_filter"
                    @change="(value)=>storeSetting.save('auto_read_copy_filter',value)"
                />
            </div>
            <span>{{ $t('main_auto_fill') }}</span>
            <Align>
                <InputNumber :model-value="storeSetting.items.fill_history_expire" :width="120" @change="(value)=>storeSetting.save('fill_history_expire',value)"/>
                <span style="font-size: 12px">{{ $t('main_auto_fill_explain', [storeSetting.items.fill_history_expire]) }}</span>
            </Align>
            <span>{{ $t('main_common_tool') }}</span>
            <div>
                <Button :size="'small'" @click="openCommon = !openCommon" :text="`${$t(`main_ui_config`)}`"/>
            </div>
            <template v-if="platform.runtime.webSecurity()">
                <span>{{ $t('main_network_request_proxy') }}</span>
                <Align>
                    <Bool
                        :label="$t(`main_ui_enable`)"
                        :model-value="storeSetting.items.proxy_enable"
                        @change="(value)=>storeSetting.save('proxy_enable',value)"
                    />
                    <template v-if="storeSetting.items.proxy_enable">
                        <Input :model-value="storeSetting.items.proxy_url" :width="400" @change="(value)=>storeSetting.save('proxy_url',value)">
                            <template #append>
                                <Icon hover name="refresh" @click="storeSetting.save('proxy_url',proxy.defaultProxyUrl)" :tooltip="$t('main_ui_reset')"/>
                            </template>
                        </Input>
                        <Link type="primary" style="font-size: 12px" href="https://ctool.dev/privacy">{{ $t('main_privacy_policy') }}</Link>
                    </template>
                </Align>
            </template>
            <template v-if="platform.isUtools()">
                <span>uTools</span>
                <div>
                    <Button :size="'small'" @click="openUtoolsKeyword = !openUtoolsKeyword" :text="`${$t(`main_ui_keyword`)}${$t(`main_ui_config`)}`"/>
                </div>
            </template>
            <span>{{ $t('main_setting_zoom') }}</span>
            <Align>
                <Select
                    :model-value="storeSetting.items.zoom"
                    @change="(value)=>storeSetting.save('zoom',value)"
                    :options="zoomOptions"
                />
                <Button
                    v-if="storeSetting.items.zoom !== 100"
                    :size="'small'"
                    :text="$t('main_ui_reset')"
                    @click="storeSetting.save('zoom', 100)"
                />
            </Align>
            <span>{{ $t('main_ui_other') }}</span>
            <div>
                <Bool
                    :label="$t(`main_history_icon_badge_hidden`)"
                    :model-value="storeSetting.items.history_icon_badge_hidden"
                    @change="(value)=>storeSetting.save('history_icon_badge_hidden',value)"
                />
            </div>
            <div class="ctool-setting-section ctool-setting-section-ai">
                <div class="ctool-setting-section-title">{{ $t('main_ai_setting') }}</div>
                <div class="ctool-ai-panel">
                    <div class="ctool-ai-panel-header">
                        <div class="ctool-ai-panel-summary">{{ aiProviderHint }}</div>
                    </div>
                    <div class="ctool-ai-grid">
                        <div class="ctool-ai-field">
                            <label>{{ $t('main_ai_provider') }}</label>
                            <Select
                                :model-value="storeSetting.items.ai_provider"
                                @change="(value) => onProviderChange(value)"
                                :options="aiProviderOptions"
                            />
                        </div>

                        <div class="ctool-ai-field">
                            <label>{{ $t('main_ai_model') }}</label>
                            <Input
                                :model-value="storeSetting.items.ai_model"
                                :placeholder="storeSetting.items.ai_provider === 'ollama' ? 'qwen2.5:7b' : 'gpt-4o-mini'"
                                @change="(value) => storeSetting.save('ai_model', value)"
                            />
                            <div class="ctool-ai-field-hint">{{ $t('main_ai_example', [aiGuideModel]) }}</div>
                        </div>

                        <div class="ctool-ai-field ctool-ai-field-full">
                            <label>{{ $t('main_ai_base_url') }}</label>
                            <Input
                                :model-value="storeSetting.items.ai_base_url"
                                :placeholder="storeSetting.items.ai_provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com'"
                                @change="(value) => storeSetting.save('ai_base_url', value)"
                            />
                            <div class="ctool-ai-field-hint">
                                {{ $t('main_ai_example', [aiGuideBaseUrl]) }}
                                <template v-if="storeSetting.items.ai_provider === 'openai_compatible'">
                                    {{ $t('main_ai_openai_compatible_tip') }}
                                </template>
                            </div>
                        </div>

                        <template v-if="storeSetting.items.ai_provider === 'openai_compatible'">
                            <div class="ctool-ai-field ctool-ai-field-full">
                                <label>{{ $t('main_ai_api_key') }}</label>
                                <Input
                                    :model-value="storeSetting.items.ai_api_key"
                                    :type="showApiKey ? 'text' : 'password'"
                                    placeholder="sk-..."
                                    autocomplete="off"
                                    @change="(value) => storeSetting.save('ai_api_key', value)"
                                >
                                    <template #append>
                                        <Button
                                            :size="'small'"
                                            :text="$t(showApiKey ? 'main_ai_hide_api_key' : 'main_ai_show_api_key')"
                                            @click="showApiKey = !showApiKey"
                                        />
                                    </template>
                                </Input>
                                <div class="ctool-ai-field-hint">
                                    <span class="ctool-ai-field-note-primary">{{ $t('main_ai_privacy_note_primary') }}</span>
                                    <span>{{ $t('main_ai_privacy_note_secondary') }}</span>
                                </div>
                            </div>
                        </template>

                        <div class="ctool-ai-actions ctool-ai-field-full">
                            <Button
                                :loading="aiTesting"
                                :disabled="!storeSetting.items.ai_base_url || !storeSetting.items.ai_model"
                                :text="$t('main_ai_test_connection')"
                                @click="testAiConnection"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Card>
    <ExtendPage v-model="openUtoolsKeyword" disable-replace>
        <UtoolsKeyword v-if="platform.isUtools()"/>
    </ExtendPage>
    <ExtendPage v-model="openCommon" disable-replace>
        <Common/>
    </ExtendPage>
</template>

<script setup lang="ts">
import useSetting from "@/store/setting"
import {useClipboardPermission} from "@/helper/clipboard"
import {locales, themes} from "@/types"
import platform from "@/helper/platform"
import {getLocaleName} from "@/i18n"
import UtoolsKeyword from "./utools/Keyword.vue"
import Common from "./Common.vue";
import {version, buildTimestamp} from "@/helper/util";
import {proxy} from "ctool-config"
import dayjs from "dayjs";
import Bool from "@/components/ui/Bool.vue";
import Align from "@/components/Align.vue";
import Input from "@/components/ui/Input.vue";
import Link from "@/components/ui/Link.vue";
import Button from "@/components/ui/Button.vue";
import InputNumber from "@/components/ui/InputNumber.vue";
import { defaultAiConfig, chat } from "@/helper/llm";
import type {AiProvider, AiConfig} from "@/helper/llm";
import Message from "@/helper/message";

const storeSetting = useSetting()
const openUtoolsKeyword = $ref(false)
const openCommon = $ref(false)

const lastUpdate = dayjs.unix(buildTimestamp).format('YYYY-MM-DD HH:mm:ss')

const localeOptions = locales.map((item) => {
    return {value: item, label: getLocaleName(item) || ""}
})

const {state: clipboardState} = useClipboardPermission()

// 缩放比例选项
const zoomOptions = [50, 60, 70, 75, 80, 85, 90, 95, 100, 110, 120, 125, 130, 140, 150, 175, 200].map(v => ({
    value: v,
    label: `${v}%`,
}))

// AI 设置相关
const aiProviderOptions = [
    {value: "ollama" as AiProvider, label: $t("main_ai_provider_ollama")},
    {value: "openai_compatible" as AiProvider, label: $t("main_ai_provider_openai_compatible")},
]

// 切换 provider 时自动填充默认地址和模型
const onProviderChange = (value: AiProvider) => {
    storeSetting.save("ai_provider", value)
    if (value === "ollama") {
        storeSetting.save("ai_base_url", defaultAiConfig.baseUrl)
        storeSetting.save("ai_model", defaultAiConfig.model)
    } else {
        storeSetting.save("ai_base_url", "")
        storeSetting.save("ai_model", "")
    }
}

let aiTesting = $ref(false)
const showApiKey = $ref(false)

// 获取当前 AI 配置快照
const getAiConfig = (): AiConfig => ({
    provider: storeSetting.items.ai_provider,
    baseUrl: storeSetting.items.ai_base_url,
    apiKey: storeSetting.items.ai_api_key,
    model: storeSetting.items.ai_model,
})

const aiProviderHint = $computed(() => {
    if (storeSetting.items.ai_provider === "ollama") {
        return $t("main_ai_provider_hint_ollama")
    }
    return $t("main_ai_provider_hint_openai_compatible")
})

const aiGuideBaseUrl = $computed(() => {
    if (storeSetting.items.ai_provider === "ollama") {
        return "http://localhost:11434"
    }
    return "https://api.example.com/v1"
})

const aiGuideModel = $computed(() => {
    if (storeSetting.items.ai_provider === "ollama") {
        return "qwen2.5:7b"
    }
    return "gpt-4o-mini / ep-xxxxxx"
})

// 测试 AI 连接
const testAiConnection = async () => {
    aiTesting = true
    try {
        const config = getAiConfig()
        if (!config.baseUrl || !config.model) {
            throw new Error($t("main_ai_not_configured"))
        }
        await chat([{role: "user", content: "Hi, just say OK"}], config)
        Message.success($t("main_ai_test_success"))
    } catch (e: any) {
        Message.error($t("main_ai_test_fail", [e?.message || String(e)]))
    } finally {
        aiTesting = false
    }
}
</script>
<style>
.ctool-setting {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 15px 20px;
}

.ctool-setting > span {
    display: flex;
    align-items: center;
    justify-content: right;
    min-width: 0;
}

.ctool-setting-section {
    grid-column: 1 / -1;
}

.ctool-setting-section-title {
    display: flex;
    align-items: center;
    font-weight: 700;
    padding-top: 14px;
    margin-bottom: 12px;
    border-top: 1px solid var(--ctool-border-color);
}

.ctool-ai-panel {
    border: 1px solid var(--ctool-border-color);
    border-radius: var(--border-radius);
    background-color: var(--ctool-block-title-bg-color);
    padding: 16px;
}

.ctool-ai-panel-header {
    margin-bottom: 14px;
}

.ctool-ai-panel-summary {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ctool-info-color);
}

.ctool-ai-grid {
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    gap: 14px 16px;
    align-items: start;
}

.ctool-ai-field {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ctool-ai-field-full {
    grid-column: 1 / -1;
}

.ctool-ai-field label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color);
}

.ctool-ai-field-hint {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ctool-info-color);
    overflow-wrap: anywhere;
}

.ctool-ai-field-note-primary {
    color: var(--color);
    font-weight: 500;
    margin-right: 6px;
}

.ctool-ai-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 2px;
    margin-top: 2px;
    border-top: 1px solid var(--ctool-border-color);
}

@media (max-width: 900px) {
    .ctool-setting {
        grid-template-columns: 96px minmax(0, 1fr);
        gap: 12px 14px;
    }
}

@media (max-width: 720px) {
    .ctool-ai-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .ctool-ai-actions {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
