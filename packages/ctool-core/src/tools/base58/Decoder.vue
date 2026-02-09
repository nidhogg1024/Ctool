<template>
    <HeightResize v-slot="{small,large}" :reduce="5">
        <Align direction="vertical">
            <TextInput
                v-model="action.current.input"
                :allow="['text']"
                :height="small"
            />
            <TextOutput
                v-model="action.current.output"
                :allow="['text','hex']"
                :content="output"
                :height="large"
                @success="action.save()"
                encoding
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

// 将 Base58 字符串解码为原始文本/Hex
const output = $computed(() => {
    if (action.current.input.text.isEmpty()) {
        return Text.empty();
    }
    if (action.current.input.text.isError()) {
        return action.current.input.text;
    }
    try {
        const decoded = bs58.decode(action.current.input.text.toString().trim());
        return Text.fromUint8Array(decoded);
    } catch (e) {
        return Text.fromError($error(e));
    }
});
</script>
