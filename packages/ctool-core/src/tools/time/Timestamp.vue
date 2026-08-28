<template>
    <Align direction="vertical">
        <Select
            size="large"
            width="100%"
            :center="false"
            :label="$t('time_timezone')"
            v-model="action.current.timezone"
            :options="timezoneOptions"
            :filterable="true"
            @change="value => (action.current.timezone = value)"
        />
        <div class="timestamp-input-row">
            <div class="timestamp-input">
                <Input
                    size="large"
                    v-model="action.current.input"
                    :label="$t('main_ui_input')"
                    :placeholder="$t('time_timestamp_input_placeholder')"
                />
            </div>
            <div v-if="action.current.input !== ''" class="timestamp-input-actions">
                <Select
                    v-if="output.type === InputType.unix"
                    class="timestamp-format-select"
                    v-model="action.current.format"
                    size="small"
                    :options="[
                        {
                            value: `auto`,
                            label: `${$t('time_unix_auto')}:${$t(`time_unix_${output.autoFormat}`)}`,
                        },
                        { value: Format.second, label: $t('time_unix_second') },
                        { value: Format.millisecond, label: $t('time_unix_millisecond') },
                        { value: Format.nanosecond, label: $t('time_unix_nanosecond') },
                    ]"
                />
                <Button :text="$t(`main_ui_clear`)" @click="action.current.input = ''" size="small" />
            </div>
        </div>
        <Display
            position="right-center"
            :text="output.isValid ? $t(`main_ui_copy`) : ''"
            @click="() => $copy(output.second)"
        >
            <Input readonly size="large" :model-value="output.second" :label="$t(`time_second`)" />
        </Display>
        <div v-row="`1-1`">
            <Display
                position="right-center"
                :text="output.isValid ? $t(`main_ui_copy`) : ''"
                @click="() => $copy(output.millisecond)"
            >
                <Input readonly size="large" :model-value="output.millisecond" :label="$t(`time_millisecond`)" />
            </Display>
            <Display
                position="right-center"
                :text="output.isValid ? $t(`main_ui_copy`) : ''"
                @click="() => $copy(output.nanosecond)"
            >
                <Input readonly size="large" :model-value="output.nanosecond" :label="$t(`time_nanosecond`)" />
            </Display>
        </div>
        <div>
            <Table
                :columns="[
                    { title: $t(`time_format`), key: `format` },
                    { title: $t(`time_value`), key: `value` },
                ]"
                :lists="example"
                :action-width="100"
                border
            >
                <template #column="{ row }">
                    <td>{{ row.format }}</td>
                    <td>
                        <Link @click="$copy(row.value)">{{ row.value }}</Link>
                    </td>
                </template>
                <template #default="{ row }">
                    <Button
                        :text="$t(`main_ui_load`)"
                        @click="() => (action.current.input = `${row.value}`)"
                        :size="'small'"
                    />
                </template>
            </Table>
        </div>
    </Align>
</template>

<script lang="ts" setup>
import { useAction, initialize } from "@/store/action";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { onUnmounted, watch } from "vue";
import { Format, transform, InputType } from "./util/timestamp";
import { timezoneOptions, resolveTimezone } from "./util/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const format = "auto" as Format | "auto";

const action = useAction(
    await initialize(
        {
            input: "",
            timezone: resolveTimezone(dayjs.tz.guess()),
            format,
        },
        {
            paste: str =>
                new RegExp(/^\d+-\d+-\d+ \d+:\d+:\d+$/).test(str) ||
                new RegExp(/^\d+-\d+-\d+ \d+:\d+:\d+\.\d+$/).test(str) ||
                new RegExp(/^-?\d{5,}$/).test(str) ||
                // 科学计数法
                new RegExp(/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(e[-+]?\d+)?$/i).test(str),
        },
    ),
);

const output = $computed(() => {
    let input = (action.current.input || "").trim();
    // 科学计数法
    if (action.current.input.toLowerCase().includes("e")) {
        input = `${parseFloat(action.current.input)}`;
    }
    return transform(input, action.current.timezone, action.current.format);
});

watch(
    () => {
        return {
            data: action.current,
            is_valid: output.isValid,
            format: output.format,
        };
    },
    ({ is_valid }) => {
        if (is_valid) {
            action.save();
        }
    },
    { immediate: true, deep: true },
);

let current = $ref(dayjs().valueOf());
const currentTimer = setInterval(() => {
    current = dayjs().valueOf();
}, 100);
onUnmounted(() => {
    clearInterval(currentTimer);
});

const example = $computed(() => {
    const day = dayjs(current).tz(action.current.timezone);
    return [
        { format: $t("time_normal_second"), value: day.format("YYYY-MM-DD HH:mm:ss") },
        { format: $t("time_unix_second"), value: day.unix().toString() },
        { format: $t("time_normal_millisecond"), value: day.format("YYYY-MM-DD HH:mm:ss.SSS") },
        { format: $t("time_unix_millisecond"), value: day.valueOf().toString() },
    ];
});
</script>

<style scoped>
.timestamp-input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    width: 100%;
}

.timestamp-input {
    flex: 1 1 20rem;
    min-width: min(100%, 12rem);
}

.timestamp-input-actions {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: 0.35rem;
    justify-content: flex-end;
    max-width: min(100%, 24rem);
    margin-left: auto;
}

.timestamp-format-select {
    flex: 1 1 0;
    min-width: 0;
    max-width: 100%;
}

.timestamp-format-select :deep(.ctool-select-summary) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.timestamp-format-select :deep(ul[role="listbox"]) {
    box-sizing: border-box;
    right: max(0.5rem, calc(var(--ctool-select-menu-right) - 3rem));
    min-width: min(var(--ctool-select-menu-width), calc(100vw - 1rem));
    max-width: calc(100vw - 1rem);
}

.timestamp-format-select :deep(ul[role="listbox"] li a) {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap;
}
</style>
