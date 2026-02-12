<template>
    <Align direction="vertical">
        <Display position="right-center">
            <Input
                size="large"
                v-model="action.current.input"
                :label="$t('main_ui_input')"
                :placeholder="$t('mongoObjectId_input_placeholder')"
            />
            <template #extra>
                <Align>
                    <Button
                        :text="$t('mongoObjectId_generate')"
                        @click="generate"
                        size="small"
                    />
                    <Button
                        v-if="action.current.input !== ''"
                        :text="$t(`main_ui_clear`)"
                        @click="action.current.input = ''"
                        size="small"
                    />
                </Align>
            </template>
        </Display>
        <Card :title="$t('mongoObjectId_result')" v-if="result.valid" padding="15px">
            <Align direction="vertical">
                <Display position="right-center" :text="$t('main_ui_copy')" @click="() => $copy(result.timestamp)">
                    <Input readonly size="large" :model-value="result.timestamp" :label="$t('mongoObjectId_timestamp')" />
                </Display>
                <Display position="right-center" :text="$t('main_ui_copy')" @click="() => $copy(result.datetime)">
                    <Input readonly size="large" :model-value="result.datetime" :label="$t('mongoObjectId_datetime')" />
                </Display>
                <Display position="right-center" :text="$t('main_ui_copy')" @click="() => $copy(result.machineId)">
                    <Input readonly size="large" :model-value="result.machineId" :label="$t('mongoObjectId_machine')" />
                </Display>
                <Display position="right-center" :text="$t('main_ui_copy')" @click="() => $copy(result.processId)">
                    <Input readonly size="large" :model-value="result.processId" :label="$t('mongoObjectId_process')" />
                </Display>
                <Display position="right-center" :text="$t('main_ui_copy')" @click="() => $copy(result.counter)">
                    <Input readonly size="large" :model-value="result.counter" :label="$t('mongoObjectId_counter')" />
                </Display>
            </Align>
        </Card>
    </Align>
</template>

<script lang="ts" setup>
import { initialize, useAction } from "@/store/action";
import { watch } from "vue";
import dayjs from "dayjs";

const action = useAction(await initialize({ input: "" }));

/**
 * 解析 MongoDB ObjectId
 * ObjectId 结构（12 字节，24 个十六进制字符）:
 * - 前 4 字节: Unix 时间戳（秒）
 * - 接 5 字节: 随机值（旧版为 机器ID 3字节 + 进程ID 2字节）
 * - 最后 3 字节: 递增计数器
 */
const result = $computed(() => {
    const input = action.current.input.trim();
    if (!input) {
        return { valid: false, timestamp: '', datetime: '', machineId: '', processId: '', counter: '' };
    }
    // 校验是否为合法的 24 位十六进制字符串
    if (!/^[0-9a-f]{24}$/i.test(input)) {
        return { valid: false, timestamp: '', datetime: '', machineId: '', processId: '', counter: '' };
    }

    try {
        // 提取时间戳（前 8 个字符 = 4 字节）
        const timestampHex = input.substring(0, 8);
        const unixTimestamp = parseInt(timestampHex, 16);
        const datetime = dayjs.unix(unixTimestamp).format('YYYY-MM-DD HH:mm:ss');

        // 提取机器标识（中间 10 个字符 = 5 字节，旧版为机器ID+进程ID）
        const machineId = input.substring(8, 14);
        const processId = input.substring(14, 18);
        const counter = input.substring(18, 24);

        return {
            valid: true,
            timestamp: String(unixTimestamp),
            datetime,
            machineId,
            processId,
            counter: String(parseInt(counter, 16)),
        };
    } catch {
        return { valid: false, timestamp: '', datetime: '', machineId: '', processId: '', counter: '' };
    }
});

// 解析成功时保存历史记录（避免在 computed 中产生副作用）
watch(() => result.valid, (valid) => {
    if (valid) {
        action.save();
    }
});

// 生成一个新的 ObjectId
const generate = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const counter = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    action.current.input = timestamp + random + counter;
};
</script>
