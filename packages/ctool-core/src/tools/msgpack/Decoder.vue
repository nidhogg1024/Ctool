<template>
    <HeightResize v-slot="{small,large}" :reduce="5">
        <Align direction="vertical">
            <TextInput
                v-model="action.current.input"
                :height="small"
                :allow="['hex', 'base64', 'upload']"
                upload="file"
            />
            <SerializeOutput
                v-model="action.current.output"
                :allow="['json', 'yaml', 'toml', 'xml', 'properties', 'php_array', 'php_serialize', 'http_query_string']"
                :content="output"
                :height="large"
                @success="action.save()"
            />
        </Align>
    </HeightResize>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { createSerializeOutput } from "@/components/serialize";
import { createTextInput } from "@/components/text";
import { decodeMsgpack } from "./util";

const action = useAction(await initialize({
    input: createTextInput("hex"),
    output: createSerializeOutput("json"),
}, { paste: false }));

const output = $computed(() => {
    return decodeMsgpack(action.current.input.text);
});
</script>
