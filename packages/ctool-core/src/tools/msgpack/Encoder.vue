<template>
    <HeightResize v-slot="{small,large}" :reduce="5">
        <Align direction="vertical">
            <SerializeInput
                v-model="action.current.input"
                :height="small"
            />
            <TextOutput
                v-model="action.current.output"
                :allow="['hex', 'base64', 'down']"
                :content="output"
                :height="large"
                @success="action.save()"
            />
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { createSerializeInput } from "@/components/serialize";
import { createTextOutput } from "@/components/text";
import { encodeMsgpack } from "./util";

const action = useAction(await initialize({
    input: createSerializeInput("json"),
    output: createTextOutput("hex"),
}, { paste: false }));

const output = $computed(() => {
    return encodeMsgpack(action.current.input.serialization);
});
</script>
