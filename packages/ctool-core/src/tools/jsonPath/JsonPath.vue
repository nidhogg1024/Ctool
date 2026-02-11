<template>
    <HeightResize v-slot="{ height }" :append="['.ctool-page-option']">
        <div v-row="'1-1'" :style="{ height: `${height}px` }">
            <Editor v-model="action.current.input" lang="json" :height="`${height}px`" :placeholder="$t('jsonPath_json_input')" />
            <Editor :model-value="output" lang="json" :height="`${height}px`" :placeholder="$t('jsonPath_result')" />
        </div>
    </HeightResize>
    <Align horizontal="center" class="ctool-page-option">
        <Input v-model="action.current.expression" :width="500" :placeholder="$t('jsonPath_placeholder')">
            <template #append>
                <HelpTip link="https://www.npmjs.com/package/jsonpath-plus" />
            </template>
        </Input>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import { JSONPath } from "jsonpath-plus";
import { isObject } from "lodash";
import formatter from "../code/formatter";

const action = useAction(await initialize({
    input: '{\n  "store": {\n    "book": [\n      { "title": "Book A", "author": "Author 1", "price": 10 },\n      { "title": "Book B", "author": "Author 2", "price": 20 }\n    ]\n  }\n}',
    expression: "$.store.book[*].author",
}));

let output = $ref("");

watch(() => ({
    input: action.current.input,
    expression: action.current.expression,
}), async ({ input, expression }) => {
    output = "";
    const exp = expression.trim();
    const json = input.trim();
    if (!json || !exp) return;
    try {
        const parsed = JSON.parse(json);
        const result = JSONPath({ path: exp, json: parsed });
        if (isObject(result)) {
            output = await formatter.simple("json", "beautify", result);
        } else {
            output = `${result}`;
        }
        action.save();
    } catch (e) {
        output = $error(e);
    }
}, { immediate: true, deep: true });
</script>
