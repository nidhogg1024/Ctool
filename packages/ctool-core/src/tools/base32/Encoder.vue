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
import { encodeBase32 } from "./util";

const action = useAction(await initialize({
    input: createTextInput("text"),
    output: createTextOutput("text"),
}));

const output = $computed(() => {
    if (action.current.input.text.isEmpty()) {
        return Text.empty();
    }
    if (action.current.input.text.isError()) {
        return action.current.input.text;
    }
    try {
        return Text.fromString(encodeBase32(action.current.input.text.toUint8Array()));
    } catch (e) {
        return Text.fromError($error(e));
    }
});
</script>
