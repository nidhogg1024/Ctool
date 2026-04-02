<template>
    <Teleport to="#ctool-append">
        <!-- 遮罩层 -->
        <Transition name="ctool-drawer-backdrop">
            <div class="ctool-drawer-backdrop" :style="backdropStyle" v-if="show" @click="close"></div>
        </Transition>
        <!-- 抽屉面板 -->
        <Transition name="ctool-drawer">
            <div class="ctool-drawer" :class="{'ctool-drawer-resizable': props.resizable}" :style="drawerStyle" v-if="show" v-bind="$attrs">
                <div
                    v-if="props.resizable"
                    class="ctool-drawer-resize-handle"
                    @pointerdown="startResize"
                ></div>
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
    },
    resizable: {
        type: Boolean,
        default: false
    },
    resizeKey: {
        type: String,
        default: ''
    },
    minWidth: {
        type: Number,
        default: 420
    },
    maxWidth: {
        type: Number,
        default: 1200
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

const STORAGE_PREFIX = "ctool_extend_page_width_"

let top = $ref(document.querySelector<HTMLElement>('.ctool-header')?.offsetHeight || 33)
let bottom = $ref(document.querySelector<HTMLElement>('.ctool-bottom')?.offsetHeight || 33)
let drawerWidth = $ref(500)
let resizing = $ref(false)
let hasCustomWidth = $ref(false)
let dragStartX = $ref(0)
let dragStartWidth = $ref(0)
let prevBodyCursor = $ref("")
let prevBodyUserSelect = $ref("")

const parseWidth = (width: string): number => {
    const value = width.trim()
    if (value.endsWith("%")) {
        const percent = parseFloat(value)
        return Number.isFinite(percent) ? (window.innerWidth * percent / 100) : 500
    }
    const size = parseFloat(value)
    return Number.isFinite(size) ? size : 500
}

const getMaxDrawerWidth = () => {
    return Math.min(props.maxWidth, Math.floor(window.innerWidth * 0.9))
}

const clampDrawerWidth = (width: number) => {
    const maxWidth = Math.max(320, getMaxDrawerWidth())
    const minWidth = Math.min(props.minWidth, maxWidth)
    return Math.max(minWidth, Math.min(width, maxWidth))
}

const getSavedWidth = () => {
    if (!props.resizeKey) {
        return null
    }
    try {
        const width = localStorage.getItem(`${STORAGE_PREFIX}${props.resizeKey}`)
        if (!width) {
            return null
        }
        const value = parseFloat(width)
        return Number.isFinite(value) ? value : null
    } catch {
        return null
    }
}

const saveWidth = (width: number) => {
    if (!props.resizeKey) {
        return
    }
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${props.resizeKey}`, String(Math.round(width)))
    } catch {
        // ignore storage failures
    }
}

const syncDrawerWidth = () => {
    const fallbackWidth = clampDrawerWidth(parseWidth(props.width))
    const savedWidth = getSavedWidth()
    if (savedWidth !== null) {
        drawerWidth = clampDrawerWidth(savedWidth)
        hasCustomWidth = true
        return
    }
    if (!hasCustomWidth) {
        drawerWidth = fallbackWidth
        return
    }
    drawerWidth = clampDrawerWidth(drawerWidth || fallbackWidth)
}

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
        "width": props.resizable ? `${drawerWidth}px` : `min(${props.width}, 90vw)`,
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
        syncDrawerWidth()
        setTimeout(() => {
            componentResizeDispatch()
        }, 600)
    }
}, {immediate: true})

watch(() => props.width, () => {
    if (!props.resizable) {
        return
    }
    syncDrawerWidth()
})

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
    if (props.resizable) {
        drawerWidth = clampDrawerWidth(drawerWidth || parseWidth(props.width))
    }
}

const stopResize = () => {
    if (!resizing) {
        return
    }
    resizing = false
    window.removeEventListener("pointermove", handleResize)
    window.removeEventListener("pointerup", stopResize)
    window.removeEventListener("pointercancel", stopResize)
    document.body.style.cursor = prevBodyCursor
    document.body.style.userSelect = prevBodyUserSelect
    saveWidth(drawerWidth)
    componentResizeDispatch()
}

const handleResize = (event: PointerEvent) => {
    if (!resizing) {
        return
    }
    drawerWidth = clampDrawerWidth(dragStartWidth + (dragStartX - event.clientX))
    hasCustomWidth = true
    componentResizeDispatch()
}

const startResize = (event: PointerEvent) => {
    if (!props.resizable) {
        return
    }
    resizing = true
    dragStartX = event.clientX
    dragStartWidth = drawerWidth || clampDrawerWidth(parseWidth(props.width))
    prevBodyCursor = document.body.style.cursor
    prevBodyUserSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", handleResize)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)
    event.preventDefault()
}

onMounted(() => {
    syncDrawerWidth()
    event.addListener('extend_page_close', closeExtendPageListener)
    event.addListener("window_height_resize", resize)
})
onUnmounted(() => {
    stopResize()
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

.ctool-drawer-resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    width: 10px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
    z-index: 2;
}

.ctool-drawer-resize-handle::before {
    content: "";
    position: absolute;
    left: 4px;
    top: 0;
    width: 2px;
    height: 100%;
    background-color: transparent;
    transition: background-color 0.15s ease;
}

.ctool-drawer-resizable:hover .ctool-drawer-resize-handle::before,
.ctool-drawer-resize-handle:hover::before {
    background-color: var(--ctool-primary);
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
