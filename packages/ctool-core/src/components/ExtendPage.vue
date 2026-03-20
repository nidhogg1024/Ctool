<template>
    <Teleport to="#ctool-append">
        <!-- 遮罩层 -->
        <Transition name="ctool-drawer-backdrop">
            <div class="ctool-drawer-backdrop" :style="backdropStyle" v-if="show" @click="close"></div>
        </Transition>
        <!-- 抽屉面板 -->
        <Transition name="ctool-drawer">
            <div class="ctool-drawer" :style="drawerStyle" v-if="show" v-bind="$attrs">
                <div class="ctool-drawer-body">
                    <slot></slot>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
<script lang="ts">
import Event from "@/event";

export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import {onMounted, onUnmounted, StyleValue, watch} from "vue";
import event, {componentResizeDispatch} from "@/event";

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    disableReplace: {
        type: Boolean,
        default: false
    },
    offset: {
        type: Number,
        default: 0
    },
    closeText:{
        type: String,
        default: ''
    },
    width: {
        type: String,
        default: '500px'
    }
})

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        Event.dispatch('extend_page_close')
    }
});

let show = $computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

let top = $ref(document.querySelector<HTMLElement>('.ctool-header')?.offsetHeight || 33)
let bottom = $ref(document.querySelector<HTMLElement>('.ctool-bottom')?.offsetHeight || 33)

const backdropStyle = $computed(() => {
    const css: StyleValue = {
        "top": `${top}px`,
        "height": `calc(100vh - ${top + bottom}px)`,
    }
    return css
})

const drawerStyle = $computed(() => {
    const css: StyleValue = {
        "top": `${top + props.offset}px`,
        "height": `calc(100vh - ${top + bottom + props.offset}px)`,
        "width": `min(${props.width}, 90vw)`,
    }
    return css
})

let isCurrentOpen = false;

watch(() => show, (is) => {
    if (is && !props.disableReplace) {
        isCurrentOpen = true;
        event.dispatch('extend_page_close')
    }
    if (is) {
        setTimeout(() => {
            componentResizeDispatch()
        }, 600)
    }
}, {immediate: true})

const close = () => show = false

const closeExtendPageListener = () => {
    if (isCurrentOpen) {
        isCurrentOpen = false
        return;
    }
    close()
}

const resize = () => {
    top = document.querySelector<HTMLElement>('.ctool-header')?.offsetHeight || 33
    bottom = document.querySelector<HTMLElement>('.ctool-bottom')?.offsetHeight || 33
}

onMounted(() => {
    event.addListener('extend_page_close', closeExtendPageListener)
    event.addListener("window_height_resize", resize)
})
onUnmounted(() => {
    event.removeListener('extend_page_close', closeExtendPageListener)
    event.removeListener("window_height_resize", resize)
})
</script>

<style>
/* 遮罩层：与内容区域对齐（top/height 由 JS 动态设置） */
.ctool-drawer-backdrop {
    position: fixed;
    left: 0;
    width: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 998;
}

/* 抽屉面板 */
.ctool-drawer {
    position: fixed;
    box-sizing: border-box;
    right: 0;
    width: 500px;
    background-color: var(--background-color);
    border-left: 1px solid var(--ctool-border-color);
    overflow: hidden;
    z-index: 999;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
}

/* 内容区域 */
.ctool-drawer-body {
    width: 100%;
    height: 100%;
    overflow-y: auto;
}

/* 遮罩层动画 */
.ctool-drawer-backdrop-enter-active, .ctool-drawer-backdrop-leave-active {
    transition: opacity 0.3s ease;
}
.ctool-drawer-backdrop-enter-from, .ctool-drawer-backdrop-leave-to {
    opacity: 0;
}

/* 抽屉面板动画：从右侧滑入 */
.ctool-drawer-enter-active, .ctool-drawer-leave-active {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.ctool-drawer-enter-from, .ctool-drawer-leave-to {
    transform: translateX(100%);
}
</style>
