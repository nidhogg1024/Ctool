<template>
    <HeightResize v-slot="{small,large}" :reduce="5">
        <Align direction="vertical">
            <TextInput
                v-model="action.current.input"
                :allow="['text','hex']"
                :height="small"
                encoding
            />
            <TextOutput
                v-model="action.current.output"
                :allow="['text']"
                :content="output"
                :height="large"
                @success="action.save()"
            />
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import { useAction, initialize } from "@/store/action";
import { createTextInput, createTextOutput } from "@/components/text";
import Text from "@/helper/text";
import bs58 from "bs58";

const action = useAction(await initialize({
    input: createTextInput("text"),
    output: createTextOutput("text"),
}));

// 将输入的文本/Hex 编码为 Base58 字符串
const output = $computed(() => {
    if (action.current.input.text.isEmpty()) {
        return Text.empty();
    }
    if (action.current.input.text.isError()) {
        return action.current.input.text;
    }
    try {
        const bytes = action.current.input.text.toUint8Array();
        return Text.fromString(bs58.encode(bytes));
    } catch (e) {
        return Text.fromError($error(e));
    }
});
</script>
