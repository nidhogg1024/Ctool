/**
 * 网格布局
 * v-row="a:b" a:d布局 间距默认5px a/b 为数字
 * v-row="a-b-c|10" a:d:c布局 间距默认10px a/b/c 为数字
 * v-row="a-100px|10" a:100px布局 间距默认10px a/b 为数字
 *
 * 响应式：≤768px 时自动切换为垂直堆叠布局（1fr），避免窄屏下内容挤压
 */
import {App} from "vue";

// 小屏断点
const MOBILE_BREAKPOINT = 768;

const update = (el: HTMLElement, value: string = "") => {
    el.setAttribute('ctool-v-row',value)
    // 项目间距
    if (!value.includes("|")) {
        value = `${value}|5` // 默认值
    }
    const [column, gap] = value.split("|")
    if (column === "") {
        return;
    }
    const columns = column.split("-");
    if (columns.length < 2) {
        return;
    }
    el.style.display = "grid"
    el.style.gap = `${gap}px`

    // 小屏：垂直堆叠（内容区滚动由 .ctool-content 处理）
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        el.style.gridTemplateColumns = "1fr"
        el.style.gridTemplateRows = "auto"
    } else {
        el.style.gridTemplateColumns = columns.map((item) => {
            if (/^\d+$/.test(item)){
                return `minmax(0, ${item}fr)`
            }
            return `${item}`
        }).join(" ");
        el.style.gridTemplateRows = ""
        el.style.overflow = ""
    }
}

export default (app: App) => {
    app.directive('row', {
        beforeMount(el: HTMLElement, binding: { value: string }) {
            update(el, binding.value)
        },
        mounted(el: HTMLElement, binding: { value: string }) {
            update(el, binding.value)
            // 监听窗口大小变化，动态切换布局
            const onResize = () => update(el, binding.value)
            ;(el as any).__ctoolRowResize = onResize
            window.addEventListener("resize", onResize)
        },
        beforeUpdate(el: HTMLElement, binding: { value: string }) {
            update(el, binding.value)
        },
        updated(el: HTMLElement, binding: { value: string }) {
            update(el, binding.value)
        },
        unmounted(el: HTMLElement) {
            // 清理 resize 监听
            const onResize = (el as any).__ctoolRowResize
            if (onResize) {
                window.removeEventListener("resize", onResize)
                delete (el as any).__ctoolRowResize
            }
        },
    })
}
