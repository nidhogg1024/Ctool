<template>
    <HeightResize v-slot="{small,large}" :reduce="5">
        <Align direction="vertical">
            <Display>
                <Textarea v-model="action.current.input" :height="small" :placeholder="$t('main_ui_input')"/>
                <template #extra>
                    <Select
                        :size="'small'"
                        v-model="action.current.mode"
                        :options="[
                            {label: $t('url_encode_mode_standard'), value: 'standard'},
                            {label: $t('url_encode_mode_all'), value: 'all'},
                        ]"
                    />
                </template>
            </Display>
            <Textarea :model-value="output" :height="large" :placeholder="$t('main_ui_output')" :copy="!!output"/>
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import strictUriEncode from "strict-uri-encode";
import {useAction, initialize} from "@/store/action"

const action = useAction(await initialize({
    input: "",
    mode: "standard",
}))

/**
 * 全字符编码：将每个字符转为 %XX 形式
 * 例：.jsp → %2E%6A%73%70
 */
const encodeAllChars = (str: string): string => {
    return Array.from(str).map(char => {
        // 逐字符转换为 UTF-8 字节，再编码为 %XX
        const encoded = encodeURIComponent(char)
        if (encoded.startsWith('%')) {
            // 已经是 %XX 格式（多字节字符会产生多个 %XX）
            return encoded
        }
        // 未编码的字符（字母、数字等），手动转为 %XX
        const code = char.charCodeAt(0)
        return `%${code.toString(16).toUpperCase().padStart(2, '0')}`
    }).join('')
}

const output = $computed(() => {
    if (action.current.input === "") {
        return ""
    }
    try {
        action.save()
        if (action.current.mode === 'all') {
            return encodeAllChars(action.current.input)
        }
        return strictUriEncode(action.current.input)
    } catch (e) {
        return $error(e)
    }
})
</script>
