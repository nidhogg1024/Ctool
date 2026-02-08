<template>
    <div class="ctool-notice">
        <div class="ctool-notice-list-item" :style="props.center ? {justifyContent:`center`} : {}">
            <Icon name="message" :size="14"/>
            <Link @click="openUrl('https://github.com/nidhogg1024/Ctool/issues')">{{ $t('main_ui_issues') }}</Link>
        </div>
    </div>
</template>
<script setup lang="ts">
import {openUrl} from "@/helper/helper";

const props = defineProps({
    center: {
        type: Boolean,
        default: false
    },
})
</script>

<style scoped>
.ctool-notice {
    height: 32px;
    overflow: hidden;
}

.ctool-notice-list-item {
    height: 32px;
    font-size: 14px;
    display: flex;
    align-items: center;
    column-gap: 5px;
}
</style>
