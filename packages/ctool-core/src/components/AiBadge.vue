<template>
    <span class="ctool-ai-badge" :data-size="size" :data-variant="resolvedVariant">
        {{ count === undefined ? $t("main_ai_badge") : `${$t("main_ai_badge")} ${count}` }}
    </span>
</template>

<script setup lang="ts">
const props = defineProps({
    count: {
        type: Number,
        default: undefined,
    },
    size: {
        type: String,
        default: "small",
    },
    variant: {
        type: String,
        default: "",
    },
})

const resolvedVariant = $computed(() => props.variant || (props.count === undefined ? "inline" : "chip"))
</script>

<style scoped>
.ctool-ai-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    white-space: nowrap;
    line-height: 1;
    font-weight: 600;
}

.ctool-ai-badge[data-variant="inline"] {
    height: 14px;
    padding: 0 4px;
    border-radius: 999px;
    background-color: rgba(0, 169, 126, 0.1);
    color: var(--ctool-primary);
    font-size: 10px;
    letter-spacing: 0.04em;
    transform: translateY(-1px);
}

.ctool-ai-badge[data-variant="chip"] {
    min-width: 24px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid rgba(0, 169, 126, 0.25);
    background-color: rgba(0, 169, 126, 0.08);
    color: var(--ctool-primary);
    font-size: 11px;
    font-weight: 600;
}

.ctool-ai-badge[data-variant="chip"][data-size="default"] {
    height: 20px;
    padding: 0 8px;
    font-size: 12px;
}

.ctool-ai-badge[data-variant="inline"][data-size="default"] {
    height: 15px;
    padding: 0 5px;
    font-size: 10px;
}
</style>
